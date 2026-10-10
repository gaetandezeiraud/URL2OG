use std::path::{Path, PathBuf};
use std::time::Duration;
use std::{env, fs, io};

use url::Url;

// Screenshots older than this are captured again
const TTL: Duration = Duration::from_secs(30 * 24 * 60 * 60);

pub fn dir() -> PathBuf {
    env::var("CACHE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| "cache".into())
}

pub fn file(url: &Url) -> PathBuf {
    dir().join(format!("{:x}.png", md5::compute(url.as_str())))
}

// Exists and is younger than the TTL
pub fn is_fresh(path: &Path) -> bool {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .is_ok_and(|t| t.elapsed().is_ok_and(|age| age < TTL))
}

// Delete expired screenshots, so pages never requested again do not fill the disk
pub fn remove_expired() {
    let Ok(entries) = fs::read_dir(dir()) else {
        return;
    };
    for path in entries.flatten().map(|e| e.path()) {
        // Only our files, in case CACHE_DIR points somewhere shared
        if path.extension().is_some_and(|e| e == "png") && !is_fresh(&path) {
            let _ = fs::remove_file(path);
        }
    }
}

// Delete the cached image for a URL, returns the process exit code
pub fn clean(url: &Url) -> i32 {
    match fs::remove_file(file(url)) {
        Ok(()) => {
            println!("Successfully deleted cached image for {url}");
            0
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => {
            println!("No cached image found for {url}");
            1
        }
        Err(e) => {
            eprintln!("Error deleting cached image for {url}: {e}");
            1
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::time::SystemTime;

    #[test]
    fn expires_after_ttl() {
        let path = env::temp_dir().join(format!("url2og-ttl-{}.png", std::process::id()));
        let file = File::create(&path).unwrap();
        assert!(is_fresh(&path));

        file.set_modified(SystemTime::now() - TTL).unwrap();
        assert!(!is_fresh(&path));

        fs::remove_file(&path).unwrap();
        assert!(!is_fresh(&path));
    }
}
