const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const archiver = require('archiver');

const zipAndUpload = async (directories, parentFolderId, clientEmail, privateKey) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        private_key: privateKey,
        client_email: clientEmail
      },
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    const drive = google.drive({ version: 'v3', auth });

    for (const directory of directories) {
      const zipFileName = `${getFolderName(directory)}.zip`;
      await zipDirectory(directory, zipFileName);
      const fileId = await uploadFile(drive, zipFileName, parentFolderId);
      const downloadLink = generateDownloadLink(fileId);
      await updateTemplatesJson(zipFileName, downloadLink);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

const getFolderName = (directory) => {
  const folderName = path.basename(directory);
  const parentDir = path.dirname(directory);
  return parentDir !== '.' ? `${getFolderName(parentDir)}-${folderName}` : folderName;
};

const zipDirectory = (directory, zipFileName) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFileName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);
    archive.directory(directory, false);
    archive.finalize();
  });
};

const uploadFile = async (drive, filePath, parentFolderId) => {
  try {
    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(filePath),
    };

    const fileMetadata = {
      name: path.basename(filePath),
      parents: [parentFolderId],
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
    });

    return response.data.id;
  } catch (error) {
    throw new Error(`Failed to upload file '${filePath}' to Google Drive: ${error.message}`);
  }
};

const generateDownloadLink = (fileId) => {
  return `https://drive.google.com/uc?id=${fileId}&export=download`;
};

const updateTemplatesJson = async (zipFileName, downloadLink) => {
  try {
    const templatesPath = path.join(__dirname, '..', 'templates.json');
    const templates = require(templatesPath);

    for (const template of templates) {
      if (template.tname === getTemplateFromZipFileName(zipFileName)) {
        template.turl = downloadLink;
        break;
      }
    }

    fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
  } catch (error) {
    throw new Error(`Failed to update 'templates.json': ${error.message}`);
  }
};

const getTemplateFromZipFileName = (zipFileName) => {
  return zipFileName.replace('.zip', '');
};

const main = async () => {
  try {
    const workspace = process.argv[2];
    const parentFolderId = process.argv[3];
    const clientEmail = process.argv[4];
    const privateKey = process.argv[5];

    const directoriesPath = path.join(workspace, 'directories.json');
    const directories = require(directoriesPath);

    await zipAndUpload(directories, parentFolderId, clientEmail, privateKey);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

main();
