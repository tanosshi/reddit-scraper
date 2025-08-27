const { download } = require("../src");

(async () => {
  const filePath = await download(
    "https://www.reddit.com/r/oddlysatisfying/comments/1n1d8gz/perfect_alignment/",
    { outDir: "out" }
  );
  console.log(JSON.stringify({ imagePath: filePath || null }));
})();
