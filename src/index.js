#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Download the direct media from a Reddit post URL.
 * Supports:
 *  - Images: .jpg/.jpeg/.png/.gif
 *  - Reddit-hosted videos: media.reddit_video.fallback_url (mp4)
 *
 * @param {string} redditPostUrl - A Reddit post URL (any type of reddit url)
 * @param {object} [options]
 * @param {string} [options.outDir] - Directory to save downloads into. Defaults to current directory.
 * @returns {Promise<string|undefined>} - The downloaded file path, or undefined when nothing was downloaded.
 */

async function download(redditPostUrl, options = {}) {
  const outDir = options.outDir ?? ".";

  const inputUrl = String(redditPostUrl || "").trim();
  if (!inputUrl) throw new Error("A Reddit post URL is required");

  const jsonUrl = withRawJsonParam(ensureJsonSuffix(inputUrl));

  let res = await fetch(jsonUrl, {
    headers: defaultHeaders(),
  });
  if (res.status === 403) {
    const alt = switchSubdomain(jsonUrl);
    res = await fetch(alt, { headers: defaultHeaders() });
  }
  if (!res.ok) throw new Error(`failed request: ${res.status}`);

  const data = await res.json();
  const post = data[0]?.data?.children[0]?.data;
  if (!post) throw new Error("no post data found");

  const imageUrl = post.url_overridden_by_dest || post.url;

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Prefer direct image if available
  if (imageUrl && /\.(jpg|jpeg|png|gif)$/i.test(imageUrl)) {
    const fileName = path.join(outDir, path.basename(new URL(imageUrl).pathname));
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`failed image request: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    fs.writeFileSync(fileName, buffer);
    return fileName;
  }

  // Fallback to reddit-hosted video
  const videoUrl = getRedditVideoUrl(post);
  if (videoUrl) {
    const fileName = path.join(outDir, path.basename(new URL(videoUrl).pathname) || `${post.id || "video"}.mp4`);
    const vidRes = await fetch(videoUrl);
    if (!vidRes.ok) throw new Error(`failed video request: ${vidRes.status}`);
    const buffer = Buffer.from(await vidRes.arrayBuffer());
    fs.writeFileSync(fileName, buffer);
    return fileName;
  }

  return undefined;
}

function sanitizeForFileName(input) {
  return String(input || "")
    .replace(/[\/:*?"<>|\\]/g, "_")
    .trim()
    .slice(0, 128);
}

function formatCommentsFile(title, listing) {
  const lines = [
    `Comments for: ${title}`,
    "",
  ];
  const walk = (children, depth) => {
    for (const item of children || []) {
      if (item.kind !== "t1") continue;
      const c = item.data || {};
      const indent = "  ".repeat(depth);
      const author = c.author ? `u/${c.author}` : "[deleted]";
      const score = typeof c.score === "number" ? c.score : 0;
      const body = (c.body || "").replace(/\r\n|\r|\n/g, "\n");
      lines.push(`${indent}- ${author} [${score}]`);
      if (body) {
        const bodyLines = body.split("\n");
        for (const bl of bodyLines) {
          lines.push(`${indent}  ${bl}`);
        }
      }
      lines.push("");
      if (c.replies && c.replies.data && Array.isArray(c.replies.data.children)) {
        walk(c.replies.data.children, depth + 1);
      }
    }
  };
  walk(listing, 0);
  return lines.join("\n");
}

function ensureJsonSuffix(url) {
  return url.endsWith(".json") ? url : url.replace(/\/?$/, ".json");
}

function withRawJsonParam(url) {
  const u = new URL(url);
  if (!u.searchParams.has("raw_json")) u.searchParams.set("raw_json", "1");
  return u.toString();
}

function defaultHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
  };
}

function switchSubdomain(url) {
  const u = new URL(url);
  if (u.hostname.startsWith("old.")) {
    u.hostname = u.hostname.replace(/^old\./, "www.");
  } else if (u.hostname.startsWith("www.")) {
    u.hostname = u.hostname.replace(/^www\./, "old.");
  }
  return u.toString();
}

function getRedditVideoUrl(post) {
  // Prefer secure_media first, then media
  const secure = post?.secure_media?.reddit_video?.fallback_url;
  const plain = post?.media?.reddit_video?.fallback_url;
  return secure || plain || null;
}

/**
 * Scrape a Reddit post for text, image, and/or comments
 * @param {string} redditPostUrl
 * @param {object} [options]
 * @param {string} [options.outDir] - Output directory for files
 * @param {('image'|'video'|'text'|'full_media'|'comments'|'all')} [options.mode] - What to save
 * @returns {Promise<{ imagePath?: string, videoPath?: string, textPath?: string, commentsPath?: string, title: string, selftext: string, imageUrl?: string, videoUrl?: string }>}
 */
async function scrape(redditPostUrl, options = {}) {
  const outDir = options.outDir ?? ".";
  const mode = options.mode ?? "image";

  const inputUrl = String(redditPostUrl || "").trim();
  if (!inputUrl) throw new Error("A Reddit post URL is required");

  const jsonUrl = withRawJsonParam(ensureJsonSuffix(inputUrl));
  let res = await fetch(jsonUrl, { headers: defaultHeaders() });
  if (res.status === 403) {
    const alt = switchSubdomain(jsonUrl);
    res = await fetch(alt, { headers: defaultHeaders() });
  }
  if (!res.ok) throw new Error(`failed request: ${res.status}`);

  const data = await res.json();
  const post = data[0]?.data?.children[0]?.data;
  if (!post) throw new Error("no post data found");

  const title = post.title || "";
  const selftext = post.selftext || "";
  const imageUrl = post.url_overridden_by_dest || post.url;
  const videoUrl = getRedditVideoUrl(post);
  const commentsListing = Array.isArray(data) && data[1]?.data?.children ? data[1].data.children : [];

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const result = { title, selftext };

  if (mode === "text" || mode === "full_media" || mode === "all") {
    const baseName = sanitizeForFileName(title) || post.id || "post";
    const textPath = path.join(outDir, `${baseName}.txt`);
    const url = `https://www.reddit.com${post.permalink || ""}`;
    const headerLines = [
      `Title: ${title}`,
      `Author: u/${post.author || ""}`,
      `Subreddit: r/${post.subreddit || ""}`,
      `URL: ${url}`,
      "",
    ];
    fs.writeFileSync(
      textPath,
      headerLines.join("\n") + (selftext ? selftext : "(no text body)")
    );
    result.textPath = textPath;
  }

  if (
    (mode === "image" || mode === "full_media" || mode === "all") &&
    imageUrl &&
    /\.(jpg|jpeg|png|gif)$/i.test(imageUrl)
  ) {
    const imgPath = path.join(
      outDir,
      path.basename(new URL(imageUrl).pathname)
    );
    const imgRes = await fetch(imageUrl);
    if (imgRes.ok) {
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(imgPath, buffer);
      result.imagePath = imgPath;
      result.imageUrl = imageUrl;
    }
  }

  if (
    (mode === "video" || mode === "full_media" || mode === "all") &&
    videoUrl
  ) {
    const baseName = sanitizeForFileName(title) || post.id || "post";
    const vidFileName = path.basename(new URL(videoUrl).pathname) || `${baseName}.mp4`;
    const vidPath = path.join(outDir, vidFileName);
    const vidRes = await fetch(videoUrl);
    if (vidRes.ok) {
      const buffer = Buffer.from(await vidRes.arrayBuffer());
      fs.writeFileSync(vidPath, buffer);
      result.videoPath = vidPath;
      result.videoUrl = videoUrl;
    }
  }

  if (mode === "comments" || mode === "all") {
    const baseName = sanitizeForFileName(title) || post.id || "post";
    const commentsPath = path.join(outDir, `${baseName}.comments.txt`);
    const text = formatCommentsFile(title, commentsListing);
    fs.writeFileSync(commentsPath, text);
    result.commentsPath = commentsPath;
  }

  return result;
}

module.exports = { download, scrape };

/**
 * Ability to run the module directly from the command line
 */
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    const showHelp = () => {
      console.log(
        [
          "reddit-scraper - save image, video, text, and/or comments from a Reddit post",
          "",
          "Usage:",
          "  reddit-scraper <redditPostUrl> [--out <dir>] [--image|--video|--text|--full-media|--comments|--all]",
          "",
          "Options:",
          "  -o, --out <dir>   Output directory (defaults to current dir)",
          "      --image       Save image only (default)",
          "      --video       Save video only (reddit-hosted mp4)",
          "      --text        Save text only",
          "      --full-media  Save image, video, and text (if available)",
          "      --comments    Save comments only",
          "      --all         Save image, video, text, and comments",
          "  -h, --help        Show this help",
        ].join("\n")
      );
    };

    if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
      showHelp();
      process.exit(args.length === 0 ? 1 : 0);
    }

    let outDir = ".";
    let url = args[0];
    let mode = "image";

    for (let i = 1; i < args.length; i++) {
      const a = args[i];
      if (a === "-o" || a === "--out") {
        outDir = args[i + 1];
        i++;
      } else if (a === "--text") {
        mode = "text";
      } else if (a === "--video") {
        mode = "video";
      } else if (a === "--both" || a === "--full-media") {
        mode = "full_media";
      } else if (a === "--comments") {
        mode = "comments";
      } else if (a === "--all") {
        mode = "all";
      } else if (a === "--image") {
        mode = "image";
      }
    }

    try {
      // Always use scrape for consistent metadata and JSON output
      const result = await scrape(url, { outDir, mode });
      const output = {
        title: result.title,
        imagePath: result.imagePath || null,
        videoPath: result.videoPath || null,
        textPath: result.textPath || null,
        commentsPath: result.commentsPath || null,
      };
      console.log(JSON.stringify(output));
    } catch (err) {
      console.error("error:", err?.message || err);
      process.exit(1);
    }
  })();
}
