const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: 'donchichopizza/productos',
    public_id: `producto-${req.params.id}`,
    format: 'jpg'
  })
});

const upload = multer({
  storage,
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
    }
    callback(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;