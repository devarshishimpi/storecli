const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const zipAndUpload = async (directories, parentFolderId, googleDriveApiKey) => {
  for (const directory of directories) {
    const zipFileName = `${getFolderName(directory)}.zip`;
    await zipDirectory(directory, zipFileName);
    const fileId = await uploadFile(zipFileName, parentFolderId, googleDriveApiKey);
    const downloadLink = generateDownloadLink(fileId);
    await updateTemplatesJson(zipFileName, downloadLink);
  }
};

const getFolderName = (directory) => {
  const folderName = path.basename(directory);
  const parentDir = path.dirname(directory);
  return parentDir !== '.' ? `${getFolderName(parentDir)}-${folderName}` : folderName;
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
  const templatesPath = path.join(__dirname, '..', 'templates.json');
  const templates = require(templatesPath);

  for (const template of templates) {
    if (template.tname === getTemplateFromZipFileName(zipFileName)) {
      template.turl = downloadLink;
      break;
    }
  }

  fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
};

const getTemplateFromZipFileName = (zipFileName) => {
  return zipFileName.replace('.zip', '');
};

const main = async () => {
  try {
    const workspace = process.argv[2];
    const parentFolderId = process.argv[3];
    const googleDriveApiKey = process.argv[4];

    const directoriesPath = path.join(workspace, 'directories.json');
    const directories = require(directoriesPath);

    await zipAndUpload(directories, parentFolderId, googleDriveApiKey);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

main();
