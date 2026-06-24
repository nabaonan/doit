use serde::{Deserialize, Serialize};

pub const GITHUB_RELEASES_API: &str =
    "https://api.github.com/repos/nabaonan/doit/releases/latest";

#[derive(Serialize, Deserialize, Clone)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub version: String,
    pub name: String,
    pub html_url: String,
    pub published_at: String,
    pub body: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release: Option<ReleaseInfo>,
    pub asset: Option<ReleaseAsset>,
    pub platform: String,
    pub arch: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub percentage: u8,
    pub file_name: String,
}

pub fn current_version(app: &tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

pub fn platform_key() -> (&'static str, &'static str) {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;
    (os, arch)
}

/// 根据当前平台和架构，从 release assets 中选择最合适的安装包
pub fn pick_asset_for_platform(
    assets: &[serde_json::Value],
    os: &str,
    arch: &str,
) -> Option<ReleaseAsset> {
    let candidates: Vec<(String, &serde_json::Value)> = assets
        .iter()
        .map(|a| (a["name"].as_str().unwrap_or("").to_lowercase(), a))
        .collect();

    let pick = |keywords: &[&str]| -> Option<ReleaseAsset> {
        for (name_lower, val) in &candidates {
            if keywords.iter().all(|k| name_lower.contains(k)) {
                return Some(ReleaseAsset {
                    name: val["name"].as_str().unwrap_or("").to_string(),
                    browser_download_url: val["browser_download_url"]
                        .as_str()
                        .unwrap_or("")
                        .to_string(),
                    size: val["size"].as_u64().unwrap_or(0),
                });
            }
        }
        None
    };

    match (os, arch) {
        ("macos", "aarch64") => pick(&["aarch64", "dmg"])
            .or_else(|| pick(&["aarch64", "app.tar.gz"]))
            .or_else(|| pick(&["aarch64", "app"])),
        ("macos", "x86_64") => pick(&["x64", "dmg"]),
        ("windows", "x86_64") => pick(&["x64", "setup.exe"])
            .or_else(|| pick(&["x64", ".exe"]))
            .or_else(|| pick(&["x64", ".msi"])),
        ("linux", "x86_64") => pick(&["amd64", "deb"])
            .or_else(|| pick(&["amd64", "appimage"]))
            .or_else(|| pick(&["x86_64", "rpm"])),
        ("linux", "aarch64") => pick(&["aarch64", "rpm"]),
        _ => None,
    }
}

/// 简单版本号比较："0.1.43" vs "0.1.44" → 0.1.43 < 0.1.44
pub fn is_newer(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.trim_start_matches('v')
            .split('.')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect()
    };
    let l = parse(latest);
    let c = parse(current);
    l > c
}
