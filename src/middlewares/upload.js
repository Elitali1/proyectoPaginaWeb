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
    format: 'jpg',
    // Al reemplazar la foto de un producto, se invalida la copia vieja que tiene el CDN.
    overwrite: true,
    invalidate: true
  })
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  // Solo imágenes: cualquier otro tipo de archivo se rechaza antes de subirlo a Cloudinary.
  fileFilter: (req, file, callback) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      callback(null, true);
    } else {
      const error = new Error('Solo se permiten imágenes JPG, PNG o WebP');
      error.status = 400;
      callback(error);
    }
  }
});

module.exports = upload;
