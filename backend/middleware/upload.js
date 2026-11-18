import multer from 'multer'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Uploaded images are saved in backend/uploads and served at /uploads/<name>
export const uploadFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads')

fs.mkdirSync(uploadFolder, { recursive: true })

// Only these image types are accepted. The file extension comes from this list,
// never from the name the user gave the file.
const allowedTypes = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
}

const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, uploadFolder),
    filename: (req, file, callback) => {
        callback(null, crypto.randomUUID() + allowedTypes[file.mimetype])
    }
})

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },   // 2 MB
    fileFilter: (req, file, callback) => {
        if (allowedTypes[file.mimetype]) {
            callback(null, true)
        } else {
            callback(new Error('Only JPG, PNG or WEBP images are allowed'))
        }
    }
})

// Use in a route:  router.put('/image', authUser, uploadImage, controller)
// The image field name in the form must be "image". The saved path is in req.imagePath.
export const uploadImage = (req, res, next) => {

    upload.single('image')(req, res, (error) => {

        if (error) {
            const message = error.code === 'LIMIT_FILE_SIZE'
                ? 'Image must be smaller than 2 MB'
                : error.message

            return res.status(400).json({ success: false, message })
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please choose an image' })
        }

        req.imagePath = `/uploads/${req.file.filename}`

        next()
    })
}
