const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { obfuscateFile, restoreFiles, filesToObfuscate } = require('./obfuscate');

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

  // Loại trừ thư mục .git, file zip đích, thư mục backup và file obfuscate
  if (
    relativePath.startsWith(".git") ||
    relativePath === zipFileName ||
    relativePath.includes("node_modules") ||
    relativePath === "backup" ||
    relativePath.startsWith("backup\\") ||
    relativePath.startsWith("backup/") ||
    relativePath === "obfuscate.js"
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

// Bắt đầu obfuscation trước khi nén
console.log("Bắt đầu obfuscate các file JavaScript...");
try {
  // Tạo thư mục backup nếu chưa có
  const backupDir = path.join(sourceDir, 'backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
    console.log('Đã tạo thư mục backup');
  }

  // Obfuscate từng file
  filesToObfuscate.forEach(fileName => {
    const filePath = path.join(sourceDir, fileName);
    if (fs.existsSync(filePath)) {
      obfuscateFile(fileName);
    } else {
      console.warn(`File không tồn tại: ${fileName}`);
    }
  });
  
  console.log("Hoàn thành obfuscation!");
} catch (error) {
  console.error("Lỗi trong quá trình obfuscation:", error);
  process.exit(1);
}

// Bắt đầu thêm file vào archive
console.log("Bắt đầu nén file...");
addFilesToArchive(sourceDir);

// Hoàn thành archive
archive.finalize();

// Khôi phục file gốc sau khi nén xong
output.on('close', function () {
  console.log(`Đã tạo thành công file zip: ${zipFileName}`);
  console.log(`Kích thước file: ${(archive.pointer() / 1024).toFixed(2)} KB`);
  
  console.log("Đang khôi phục file gốc...");
  try {
    restoreFiles();
    console.log("Đã khôi phục file gốc thành công!");
  } catch (error) {
    console.error("Lỗi khi khôi phục file:", error);
  }
  
  console.log("Hoàn thành!");
});
