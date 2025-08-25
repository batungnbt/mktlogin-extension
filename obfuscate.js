const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Cấu hình obfuscation đơn giản và an toàn cho Chrome Extension
const obfuscationOptions = {
  compact: true,
  controlFlowFlattening: false, // Tắt để tránh lỗi
  deadCodeInjection: false, // Tắt để tránh lỗi
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false, // Quan trọng: tránh conflict với Chrome APIs
  selfDefending: false, // Quan trọng: tránh lỗi trong extension
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  transformObjectKeys: false, // Tắt để tránh lỗi với Chrome APIs
  unicodeEscapeSequence: false
};

// Danh sách các file cần obfuscate
const filesToObfuscate = [
  'background.js',
  'xpath-selector.js',
  'popup.js',
  'content.js'
];

// Tạo thư mục backup nếu chưa có
const backupDir = path.join(__dirname, 'backup');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
  console.log('Đã tạo thư mục backup');
}

// Hàm obfuscate file
function obfuscateFile(fileName) {
  const filePath = path.join(__dirname, fileName);
  const backupPath = path.join(backupDir, fileName);
  
  try {
    // Đọc nội dung file gốc
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    
    // Backup file gốc
    fs.writeFileSync(backupPath, sourceCode);
    console.log(`Đã backup: ${fileName}`);
    
    // Obfuscate code
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(sourceCode, obfuscationOptions);
    
    // Ghi file đã obfuscate
    fs.writeFileSync(filePath, obfuscatedCode.getObfuscatedCode());
    console.log(`Đã obfuscate: ${fileName}`);
    
  } catch (error) {
    console.error(`Lỗi khi obfuscate ${fileName}:`, error.message);
  }
}

// Hàm restore file từ backup
function restoreFiles() {
  console.log('\nKhôi phục file từ backup...');
  
  filesToObfuscate.forEach(fileName => {
    const filePath = path.join(__dirname, fileName);
    const backupPath = path.join(backupDir, fileName);
    
    if (fs.existsSync(backupPath)) {
      const backupCode = fs.readFileSync(backupPath, 'utf8');
      fs.writeFileSync(filePath, backupCode);
      console.log(`Đã khôi phục: ${fileName}`);
    }
  });
}

// Hàm chính
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--restore')) {
    restoreFiles();
    return;
  }
  
  console.log('Bắt đầu obfuscate các file JavaScript...');
  console.log('Các file sẽ được obfuscate:', filesToObfuscate);
  
  filesToObfuscate.forEach(fileName => {
    const filePath = path.join(__dirname, fileName);
    if (fs.existsSync(filePath)) {
      obfuscateFile(fileName);
    } else {
      console.warn(`File không tồn tại: ${fileName}`);
    }
  });
  
  console.log('\nHoàn thành obfuscation!');
  console.log('Để khôi phục file gốc, chạy: node obfuscate.js --restore');
}

// Export functions để sử dụng trong script khác
module.exports = {
  obfuscateFile,
  restoreFiles,
  filesToObfuscate,
  obfuscationOptions
};

// Chạy script nếu được gọi trực tiếp
if (require.main === module) {
  main();
}