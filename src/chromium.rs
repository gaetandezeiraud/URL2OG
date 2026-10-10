use std::fs::{self, File};
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Condvar, LazyLock, Mutex};
use std::time::{Duration, Instant};
use std::{env, io, thread};

use url::Url;

use crate::pagecache;

// Chromium stops loading after this, then takes the screenshot anyway
const PAGE_TIMEOUT_MS: u64 = 30_000;
// Once loaded, wait for pending network requests and up to this much JS timer time
// (like puppeteer's networkidle), so content rendered by scripts is captured
const SETTLE_MS: u64 = 5_000;
// Hard kill if Chromium itself hangs
const KILL_AFTER: Duration = Duration::from_millis(PAGE_TIMEOUT_MS + 15_000);

// Each Chromium needs a few hundred MiB, MAX_CAPTURES caps how many run at once (default 1)
static MAX_CAPTURES: LazyLock<usize> = LazyLock::new(|| {
    env::var("MAX_CAPTURES")
        .ok()
        .and_then(|v| v.parse().ok())
        .filter(|&n| n > 0)
        .unwrap_or(1)
});
static RUNNING: Mutex<usize> = Mutex::new(0);
static FREED: Condvar = Condvar::new();

// A capture slot, blocks until one is free and releases it on drop
pub struct Slot;

impl Slot {
    pub fn acquire() -> Slot {
        let mut running = RUNNING.lock().unwrap();
        while *running >= *MAX_CAPTURES {
            running = FREED.wait(running).unwrap();
        }
        *running += 1;
        Slot
    }
}

impl Drop for Slot {
    fn drop(&mut self) {
        *RUNNING.lock().unwrap() -= 1;
        FREED.notify_one();
    }
}

// Capture `url` as a 1200x630 PNG written to `out`, call while holding a Slot
pub fn screenshot(url: &Url, out: &Path) -> io::Result<()> {
    static N: AtomicU64 = AtomicU64::new(0);
    let id = N.fetch_add(1, Ordering::Relaxed);
    // Chromium picks the format from the extension, so the temp file must end in .png
    let tmp = out.with_extension(format!("{id}.tmp.png"));
    let profile = env::temp_dir().join(format!("url2og-{id}.profile"));

    let mut child = Command::new(
        env::var("CHROMIUM_PATH").unwrap_or_else(|_| "/usr/lib/chromium/chromium".into()),
    )
    .args([
        "--headless",
        "--no-sandbox",
        "--no-zygote",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
        "--window-size=1200,630",
    ])
    .arg(format!("--timeout={PAGE_TIMEOUT_MS}"))
    .arg(format!("--virtual-time-budget={SETTLE_MS}"))
    .arg(format!("--user-data-dir={}", profile.display()))
    .arg(format!("--screenshot={}", tmp.display()))
    .arg(url.as_str())
    // Everything Chromium writes lands in the profile, deleted afterwards
    .env("HOME", &profile)
    .env("TMPDIR", &profile)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()?;

    let result = wait(&mut child).and_then(|status| {
        if !status.success() {
            return Err(io::Error::other(format!("chromium exited with {status}")));
        }
        // Dirty pages cannot be evicted from the page cache, flush them first
        File::open(&tmp)?.sync_data()?;
        fs::rename(&tmp, out)
    });
    kill_helpers(&profile);
    let _ = fs::remove_dir_all(&profile);
    let _ = fs::remove_file(&tmp);
    pagecache::evict_chromium();
    result
}

fn wait(child: &mut Child) -> io::Result<ExitStatus> {
    let start = Instant::now();
    loop {
        if let Some(status) = child.try_wait()? {
            return Ok(status);
        }
        if start.elapsed() > KILL_AFTER {
            let _ = child.kill();
            let _ = child.wait();
            return Err(io::Error::other("chromium timed out"));
        }
        thread::sleep(Duration::from_millis(100));
    }
}

// Chromium's helpers (crashpad, renderers) outlive the main process for a moment and keep files
// mapped, which blocks page cache eviction. crashpad even leaves the process group, but every
// helper has the profile path on its command line: kill those until none is left.
#[cfg(target_os = "linux")]
fn kill_helpers(profile: &Path) {
    let needle = profile.as_os_str().as_encoded_bytes();
    for _ in 0..200 {
        let pids = processes_mentioning(needle);
        if pids.is_empty() {
            return;
        }
        for pid in pids {
            unsafe { libc::kill(pid, libc::SIGKILL) };
        }
        thread::sleep(Duration::from_millis(10));
    }
}

// Zombies have an empty cmdline, so only live processes match
#[cfg(target_os = "linux")]
fn processes_mentioning(needle: &[u8]) -> Vec<i32> {
    let Ok(entries) = fs::read_dir("/proc") else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter_map(|e| e.file_name().to_str()?.parse().ok())
        .filter(|pid| {
            fs::read(format!("/proc/{pid}/cmdline"))
                .is_ok_and(|cmd| cmd.windows(needle.len()).any(|w| w == needle))
        })
        .collect()
}

#[cfg(not(target_os = "linux"))]
fn kill_helpers(_: &Path) {}
