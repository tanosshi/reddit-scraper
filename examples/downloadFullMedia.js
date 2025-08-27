const { scrape } = require("../src");

(async () => {
  const mode = "full_media";
  const res = await scrape(
    "https://old.reddit.com/r/madlads/comments/1n1cf4o/how_much_are_you_tipping/",
    { outDir: "out", mode }
  );

  const output = {
    mode,
    title: res.title,
    imagePath: res.imagePath || null,
    textPath: res.textPath || null,
    commentsPath: res.commentsPath || null,
  };
  console.log(JSON.stringify(output));

  // $ /reddit-scraper > node examples/downloadMedia.js
  // {"mode":"full_media","title":"How much are you tipping?","imagePath":"out\\qunt9h5p7jlf1.jpeg","textPath":"out\\How much are you tipping_.txt","commentsPath":null}
})();
