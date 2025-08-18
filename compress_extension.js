const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

// Tên file zip đích
const zipFileName = "1cf5f31f1b662420e0167da88c9a14e5.zip";
const sourceDir = __dirname;
const zipPath = path.join(sourceDir, zipFileName);

// Xóa file zip cũ nếu tồn tại
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
  console.log(`Đã xóa file zip cũ: ${zipFileName}`);
}

// Tạo stream để ghi file zip
const output = fs.createWriteStream(zipPath);
const archive = archiver("zip", {
  zlib: { level: 9 }, // Mức nén cao nhất
});

// Lắng nghe các sự kiện
output.on("close", function () {
  console.log(`Đã tạo thành công file zip: ${zipFileName}`);
  console.log(`Kích thước file: ${(archive.pointer() / 1024).toFixed(2)} KB`);
  console.log("Hoàn thành!");
});

archive.on("warning", function (err) {
  if (err.code === "ENOENT") {
    console.warn("Cảnh báo:", err);
  } else {
    throw err;
  }
});

archive.on("error", function (err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Hàm để kiểm tra xem có nên loại trừ file/thư mục không
function shouldExclude(filePath) {
  const relativePath = path.relative(sourceDir, filePath);

  // Loại trừ thư mục .git và file zip đích
  if (
    relativePath.startsWith(".git") ||
    relativePath === zipFileName ||
    relativePath.includes("node_modules")
  ) {
    return true;
  }

  return false;
}

// Hàm đệ quy để thêm file vào archive
function addFilesToArchive(dir, archiveDir = "") {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const archivePath = path.join(archiveDir, file).replace(/\\/g, "/");

    if (shouldExclude(filePath)) {
      return; // Bỏ qua file/thư mục này
    }

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Nếu là thư mục, đệ quy vào bên trong
      addFilesToArchive(filePath, archivePath);
    } else {
      // Nếu là file, thêm vào archive
      archive.file(filePath, { name: archivePath });
      console.log(`Đã thêm: ${archivePath}`);
    }
  });
}

// Bắt đầu thêm file vào archive
console.log("Bắt đầu nén file...");
addFilesToArchive(sourceDir);

// Hoàn thành archive
archive.finalize();
