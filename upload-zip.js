const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const zipAndUpload = async (directory, parentFolderId, googleDriveApiKey) => {
  // Create a zip file with the directory name
  const zipFileName = `${path.basename(directory)}.zip`;
  await zipDirectory(directory, zipFileName);

  // Upload the zip file to Google Drive
  const fileId = await uploadFile(zipFileName, parentFolderId, googleDriveApiKey);

  // Generate the download link
  const downloadLink = generateDownloadLink(fileId);

  // Update the templates.json file
  await updateTemplatesJson(zipFileName, downloadLink);
};

const zipDirectory = (directory, zipFileName) => {
  return new Promise((resolve, reject) => {
    const archiver = require('archiver');
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(directory, false);
    archive.finalize();
  });
};

const uploadFile = async (filePath, parentFolderId, googleDriveApiKey) => {
  const drive = google.drive({ version: 'v3' });
  const media = {
    mimeType: 'application/zip',
    body: fs.createReadStream(filePath),
  };

  const fileMetadata = {
    name: path.basename(filePath),
    parents: [parentFolderId],
  };

  const { data } = await drive.files.create({
    auth: googleDriveApiKey,
    resource: fileMetadata,
    media: media,
    fields: 'id',
  });

  return data.id;
};

const generateDownloadLink = (fileId) => {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
};

const updateTemplatesJson = async (zipFileName, downloadLink) => {
  const templatesJsonPath = path.join(__dirname, '..', 'templates.json');
  const templates = require(templatesJsonPath);

  const updatedTemplates = templates.map((template) => {
    if (template.tname === path.basename(zipFileName, '.zip')) {
      template.turl = downloadLink;
    }
    return template;
  });

  fs.writeFileSync(templatesJsonPath, JSON.stringify(updatedTemplates, null, 2));
};

module.exports = zipAndUpload;
