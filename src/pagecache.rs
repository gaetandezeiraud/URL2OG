// Page cache pages are charged to the container's memory (and Kubernetes working set) until the
// kernel needs them back. Dropping them right away keeps the pod at a few MiB between captures.

use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;

// What Chromium reads (from strace): its binary and resources, shared libs, fonts.
// Kept narrow on purpose, walking more directories costs more in dentry/inode slab than it frees.
const CHROMIUM_FILES: &[&str] = &[
    "/usr/lib",
    "/usr/share/fonts",
    "/usr/share/fontconfig",
    "/var/cache/fontconfig",
    "/etc/fonts",
];

// Read a file, then drop it from the page cache
pub fn read(path: &Path) -> io::Result<Vec<u8>> {
    let mut file = File::open(path)?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)?;
    evict(&file);
    Ok(bytes)
}

// Drop everything Chromium loaded, call once it has exited
pub fn evict_chromium() {
    for dir in CHROMIUM_FILES {
        evict_tree(Path::new(dir));
    }
}

fn evict_tree(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        // file_type() does not follow symlinks, so no loops
        match entry.file_type() {
            Ok(t) if t.is_dir() => evict_tree(&entry.path()),
            Ok(t) if t.is_file() => {
                if let Ok(file) = File::open(entry.path()) {
                    evict(&file);
                }
            }
            _ => {}
        }
    }
}

// Only clean, unmapped pages are dropped; pages still in use by a running Chromium stay
#[cfg(target_os = "linux")]
fn evict(file: &File) {
    use std::os::fd::AsRawFd;
    unsafe { libc::posix_fadvise(file.as_raw_fd(), 0, 0, libc::POSIX_FADV_DONTNEED) };
}

#[cfg(not(target_os = "linux"))]
fn evict(_: &File) {}
