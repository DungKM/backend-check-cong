const express = require('express');
const catalogController = require('../controllers/catalogController');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.get('/:type/template', catalogController.downloadTemplate);
router.get('/:type/imports', catalogController.listImports);
router.get('/:type', catalogController.listCatalog);
router.post('/:type/import', upload.single('file'), catalogController.importCatalog);
router.post('/:type', catalogController.createItem);
router.patch('/:type/:id', catalogController.updateItem);
router.delete('/:type/:id', catalogController.deleteItem);

module.exports = router;
