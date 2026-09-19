const Client = require('../models/Client');
const Case = require('../models/Case');
const Payment = require('../models/Payment');
const { logAudit } = require('../utils/auditLogger');

exports.listClients = async (req, res, next) => {
  try {
    const { search, clientType, status, page = 1, limit = 20 } = req.query;

    const query = { lawFirmId: req.user.lawFirmId };

    if (clientType && clientType !== 'All') {
      query.clientType = clientType;
    }
    if (status && status !== 'All') {
      query.status = status;
    }
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: new RegExp(s, 'i') },
        { email: new RegExp(s, 'i') },
        { phone: new RegExp(s, 'i') },
        { companyName: new RegExp(s, 'i') },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [clients, total] = await Promise.all([
      Client.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Client.countDocuments(query),
    ]);

    // Enhance each client with active cases count
    const enhanced = await Promise.all(
      clients.map(async (c) => {
        const caseCount = await Case.countDocuments({
          clientId: c._id,
          lawFirmId: req.user.lawFirmId,
          status: { $nin: ['Disposed', 'Closed'] },
        });
        const clientObj = c.toObject();
        clientObj.activeCases = caseCount;
        return clientObj;
      })
    );

    res.status(200).json({
      success: true,
      data: enhanced,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getClientById = async (req, res, next) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    }).populate('createdBy', 'name email');

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found or unauthorized.' });
    }

    const [cases, payments] = await Promise.all([
      Case.find({ clientId: client._id, lawFirmId: req.user.lawFirmId }).sort({ createdAt: -1 }),
      Payment.find({ clientId: client._id, lawFirmId: req.user.lawFirmId }).sort({ paymentDate: -1 }),
    ]);

    const totalAgreed = cases.reduce((acc, c) => acc + (c.agreedFee || 0), 0);
    const totalPaid = payments
      .filter((p) => p.status === 'Realized')
      .reduce((acc, p) => acc + (p.amount || 0), 0);
    const outstanding = Math.max(0, totalAgreed - totalPaid);

    res.status(200).json({
      success: true,
      data: {
        client,
        cases,
        payments,
        financialSummary: {
          totalAgreed,
          totalPaid,
          outstanding,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createClient = async (req, res, next) => {
  try {
    const { name, phone, email, address, clientType, companyName, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Client name is required.' });
    }

    const client = await Client.create({
      lawFirmId: req.user.lawFirmId,
      name,
      phone: phone || '',
      email: email ? email.toLowerCase() : '',
      address: address || '',
      clientType: clientType || 'Individual',
      companyName: companyName || '',
      notes: notes || '',
      createdBy: req.user._id,
    });

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'CLIENT_CREATED',
      entityType: 'Client',
      entityId: client._id,
      description: `Added new client: ${client.name} (${client.clientType})`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Client added successfully.',
      data: client,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found or unauthorized.' });
    }

    const fields = ['name', 'phone', 'email', 'address', 'clientType', 'companyName', 'status', 'notes'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) client[f] = req.body[f];
    });

    await client.save();

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'CLIENT_UPDATED',
      entityType: 'Client',
      entityId: client._id,
      description: `Updated client details for ${client.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Client details updated.',
      data: client,
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      lawFirmId: req.user.lawFirmId,
    });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found or unauthorized.' });
    }

    await logAudit({
      lawFirmId: req.user.lawFirmId,
      userId: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      action: 'CLIENT_DELETED',
      entityType: 'Client',
      entityId: client._id,
      description: `Deleted client ${client.name}`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: 'Client removed successfully.',
    });
  } catch (err) {
    next(err);
  }
};
