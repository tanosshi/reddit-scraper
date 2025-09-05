# reddit-scraper

_@tanosshi/reddit-scraper is a quick and simple reddit scraper, to not bloat your own code up_

<img src="thumbnail.png" alt="tanos.fm thumb" width="800px" style="border-radius: 10px; margin: 10px;">

## 🚀 How to use (quickly)

### 📦 Installation

```bash
npm install @tanosshi/reddit-scraper
```

> **💡 Info:** Node.js v18 or higher is highly recommended!

### 🛠️ Usage

## In a file

```js
const { scrape, download } = require("@tanosshi/reddit-scraper");

// Only download the image file, if present.
const imagePath = await download("https://reddit.com/r/.../comments/...", { outDir: "out", userAgent: "..." });

// Scrape post content
const res = await scrape("https://reddit.com/r/.../comments/...", {
  outDir: "out",
  download: true, // download: true | false
  userAgent: "...", // userAgent: {STRING} or leave empty
  mode: "all", // mode: 'video' | 'image' | 'text' | 'full_media' | 'comments' | 'all'
});

// res = { title, selftext?, imageUrl?, imagePath?, textPath?, commentsPath? }
})();
```

## CLI

```bash
# Basic
npx reddit-scraper <redditPostUrl>

# Output to directory
npx reddit-scraper <redditPostUrl> --out './out/'

# Modes (default is --image)
npx reddit-scraper <redditPostUrl> --text
npx reddit-scraper <redditPostUrl> --full-media
npx reddit-scraper <redditPostUrl> --comments
npx reddit-scraper <redditPostUrl> --all

# Help
npx reddit-scraper --help
```

## Outputs

Console: `{"title":"...","imagePath":"out/img.jpg","textPath":"out/post.txt","commentsPath":"out/post.comments.txt"}`

Text file structures:

```bash
Title: <title>
Author: u/<author>
Subreddit: r/<subreddit>
URL: https://www.reddit.com/...

<selftext or "(no text body)">
```

Comment files are full with threads

---

### 🤔 Options

#### Output Directory

- `outDir`: Output folder path (created if missing)
- `download`: Whether to download it in the first place or not (only works in .scrape())
- `userAgent`: Use a custom user agent incase the default one is flagged

#### Modes

- `video`: Video only
- `image`: Image only
- `text`: Text only
- `full_media`: Image + Text
- `comments`: Comments only
- `all`: Image + Text + Comments

_made with ❤️ by tanos_
