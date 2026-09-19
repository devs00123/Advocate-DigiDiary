const express = require('express');
const router = express.Router();
const {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} = require('../controllers/clientController');
const { protect, requireRole } = require('../middleware/auth');
const { enforceTenant } = require('../middleware/tenant');

router.use(protect, enforceTenant);

router.route('/')
  .get(listClients)
  .post(requireRole('admin', 'advocate', 'junior'), createClient);

router.route('/:id')
  .get(getClientById)
  .put(requireRole('admin', 'advocate', 'junior'), updateClient)
  .delete(requireRole('admin'), deleteClient);

module.exports = router;
