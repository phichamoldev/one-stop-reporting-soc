import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./app/api', (filePath) => {
  if (!filePath.endsWith('.ts')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // General { error: err.message } or with fallback
  content = content.replace(
    /\{\s*error:\s*[a-zA-Z0-9_]+\.message(?:[^}]*)\s*\}/g,
    '{ success: false, message: "Internal Server Error" }'
  );

  // Specific ones that might span multiple lines where the above regex doesn't catch due to newlines
  content = content.replace(
    /\{\s*error:\s*err instanceof Error \? err\.message : "[^"]*"\s*\}/g,
    '{ success: false, message: "Internal Server Error" }'
  );
  
  content = content.replace(
    /\{\s*success:\s*false,\s*error:\s*error\.message,\s*stack:\s*error\.stack\s*\}/g,
    '{ success: false, message: "Internal Server Error" }'
  );

  content = content.replace(
    /\{\s*success:\s*false,\s*error:\s*err instanceof Error\s*\?\s*err\.message\s*:\s*"Unknown error during initialization"\s*\}/g,
    '{ success: false, message: "Internal Server Error" }'
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log("Updated", filePath);
  }
});
