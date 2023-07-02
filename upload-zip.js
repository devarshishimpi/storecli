const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

async function uploadFileToDrive(filePath, folderId) {
  const fileMetadata = {
    name: path.basename(filePath),
    parents: [folderId],
  };

  const media = {
    mimeType: 'application/zip',
    body: fs.createReadStream(filePath),
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media,
  });

  return response.data;
}

// Example usage
const filePath = process.argv[2];
const folderId = process.argv[3];

uploadFileToDrive(filePath, folderId)
  .then((file) => {
    console.log('File uploaded successfully:', file.webViewLink);
  })
  .catch((error) => {
    console.error('Error uploading file:', error);
    process.exit(1);
  });
