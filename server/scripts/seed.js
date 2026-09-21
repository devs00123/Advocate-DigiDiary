const dotenv = require('dotenv');
dotenv.config();

if (process.env.NODE_ENV === 'production' && process.env.SEED_ON_EMPTY !== 'true') {
  console.error('\n[FATAL ERROR] SEED SCRIPT ABORTED!');
  console.error('Seed scripts are forbidden from running in PRODUCTION mode unless SEED_ON_EMPTY=true is set.\n');
  process.exit(1);
}

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');

const LawFirm = require('../models/LawFirm');
const User = require('../models/User');
const Client = require('../models/Client');
const Case = require('../models/Case');
const Hearing = require('../models/Hearing');
const Task = require('../models/Task');
const Note = require('../models/Note');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Reminder = require('../models/Reminder');
const AuditLog = require('../models/AuditLog');

const seedData = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      console.log('[SEED] Connecting to development database...');
      await connectDB();
    }

    console.log('[SEED] Clearing existing development data...');
    await Promise.all([
      LawFirm.deleteMany({}),
      User.deleteMany({}),
      Client.deleteMany({}),
      Case.deleteMany({}),
      Hearing.deleteMany({}),
      Task.deleteMany({}),
      Note.deleteMany({}),
      Payment.deleteMany({}),
      Expense.deleteMany({}),
      Reminder.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    console.log('[SEED] Creating Law Firm...');
    const lawFirm = await LawFirm.create({
      name: 'Singhania & Partners LLP',
      tagline: 'Advocates & Legal Consultants',
      chamberNumber: 'Chamber 402, Lawyers Chambers Block',
      address: 'Saket District Courts Complex, New Delhi 110017',
      phone: '+91 11 2656 4400',
      email: 'contact@singhania.law',
      barCouncilRegistration: 'D/1429/2011',
      primaryCourts: [
        'Supreme Court of India',
        'Delhi High Court',
        'Saket District Court',
        'Patiala House Courts',
        'Rohini Courts',
        'NCLT Principal Bench New Delhi',
      ],
    });

    console.log('[SEED] Creating Users with hashed passwords...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Advocate@2026', salt);

    const superadminHash = await bcrypt.hash('SuperAdmin@2026', salt);
    const superAdmin = await User.create({
      name: 'Master Super Administrator',
      email: 'superadmin@digidiary.com',
      phone: '+91 99999 00000',
      passwordHash: superadminHash,
      role: 'superadmin',
      designation: 'Platform Super Administrator',
      enrollmentNumber: 'D/ROOT/2026',
      lawFirmId: lawFirm._id,
      emailVerified: true,
      lastLogin: new Date(),
    });

    const rajesh = await User.create({
      name: 'Rajesh V. Singhania',
      email: 'rajesh@singhania.law',
      phone: '+91 98110 12345',
      passwordHash,
      role: 'admin',
      designation: 'Senior Advocate / Managing Partner',
      enrollmentNumber: 'D/1429/2011',
      lawFirmId: lawFirm._id,
      emailVerified: true,
      lastLogin: new Date(),
    });

    const ananya = await User.create({
      name: 'Ananya Deshmukh',
      email: 'ananya@singhania.law',
      phone: '+91 98220 54321',
      passwordHash,
      role: 'advocate',
      designation: 'Partner — Commercial Litigation',
      enrollmentNumber: 'D/2104/2016',
      lawFirmId: lawFirm._id,
      emailVerified: true,
    });

    const vikram = await User.create({
      name: 'Vikram Malhotra',
      email: 'vikram@singhania.law',
      phone: '+91 97110 67890',
      passwordHash,
      role: 'junior',
      designation: 'Junior Associate',
      enrollmentNumber: 'D/4502/2022',
      lawFirmId: lawFirm._id,
      emailVerified: true,
    });

    const ram = await User.create({
      name: 'Ram Charan',
      email: 'ram@singhania.law',
      phone: '+91 98990 11223',
      passwordHash,
      role: 'clerk',
      designation: 'Chief Court Clerk',
      enrollmentNumber: '',
      lawFirmId: lawFirm._id,
      emailVerified: true,
    });

    lawFirm.createdBy = rajesh._id;
    await lawFirm.save();

    console.log('[SEED] Creating Clients...');
    const rahulSharma = await Client.create({
      lawFirmId: lawFirm._id,
      name: 'Rahul Sharma',
      phone: '+91 98112 00412',
      email: 'rahul.sharma@gmail.com',
      address: 'B-44 Greater Kailash I, New Delhi',
      clientType: 'Individual',
      status: 'Active',
      notes: 'Managing Director of Apex Retail. Preferred consultation times post 4 PM.',
      createdBy: rajesh._id,
    });

    const sunitaDevi = await Client.create({
      lawFirmId: lawFirm._id,
      name: 'Smt. Sunita Devi',
      phone: '+91 97188 34910',
      email: 'sunita.devi@outlook.com',
      address: 'Plot 12, Sector 15, Rohini, Delhi',
      clientType: 'Individual',
      status: 'Active',
      notes: 'Mother of accused Rahul Kumar. Criminal revision matter.',
      createdBy: rajesh._id,
    });

    const abcEnterprises = await Client.create({
      lawFirmId: lawFirm._id,
      name: 'ABC Enterprises Ltd',
      phone: '+91 11 4150 9900',
      email: 'legal@abcenterprises.co.in',
      address: 'Barakhamba Road, Connaught Place, New Delhi',
      clientType: 'Corporate',
      companyName: 'ABC Enterprises Public Limited',
      status: 'Active',
      notes: 'Key retainer client for commercial arbitrations and Section 9 petitions.',
      createdBy: rajesh._id,
    });

    const virendraKumar = await Client.create({
      lawFirmId: lawFirm._id,
      name: 'Virendra Kumar',
      phone: '+91 99100 87654',
      email: 'vkumar.consult@gmail.com',
      address: 'Pocket C, Mayur Vihar Phase II, Delhi',
      clientType: 'Individual',
      status: 'Active',
      notes: 'Property partition dispute matter.',
      createdBy: ananya._id,
    });

    const vivanSteels = await Client.create({
      lawFirmId: lawFirm._id,
      name: 'M/s Vivan Steels Pvt Ltd',
      phone: '+91 11 2921 4455',
      email: 'accounts@vivansteels.com',
      address: 'Okhla Industrial Area Phase III, New Delhi',
      clientType: 'Corporate',
      companyName: 'Vivan Steels Private Limited',
      status: 'Active',
      notes: 'Supply contract recovery arbitration.',
      createdBy: ananya._id,
    });

    console.log('[SEED] Creating Cases...');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const case1 = await Case.create({
      lawFirmId: lawFirm._id,
      caseNumber: 'CS(COMM)/412/2024',
      cnrNumber: 'DLSK01-004521-2024',
      title: 'Sharma vs Verma',
      clientId: rahulSharma._id,
      clientRepresentation: 'Plaintiff',
      oppositeParty: 'Sunil Verma',
      oppositeCounsel: 'Adv. Meenakshi Lekhi',
      caseType: 'Commercial Suit',
      court: 'Saket District Court',
      courtroom: 'Courtroom No. 12',
      judge: "Hon'ble Judge A. K. Mishra",
      filingDate: new Date('2024-02-15'),
      currentHearingDate: new Date(today.getTime() + 9.5 * 3600 * 1000), // Today 9:30 AM
      currentStage: 'Final Arguments (Part-Heard)',
      status: 'Active',
      priority: 'urgent',
      description: 'Commercial suit for permanent injunction and rendition of accounts regarding trademark infringement.',
      agreedFee: 250000,
      assignedAdvocate: rajesh._id,
      createdBy: rajesh._id,
    });

    const case2 = await Case.create({
      lawFirmId: lawFirm._id,
      caseNumber: 'CRL.A/891/2025',
      cnrNumber: 'DLND01-008920-2025',
      title: 'State vs Rahul',
      clientId: sunitaDevi._id,
      clientRepresentation: 'Appellant',
      oppositeParty: 'State (NCT of Delhi)',
      oppositeCounsel: 'Public Prosecutor (Delhi Police)',
      caseType: 'Criminal Revision / Appeal',
      court: 'Patiala House Courts',
      courtroom: 'Courtroom No. 04',
      judge: "Hon'ble ASJ Vikramjit Singh",
      filingDate: new Date('2025-05-10'),
      currentHearingDate: new Date(today.getTime() + 11.25 * 3600 * 1000), // Today 11:15 AM
      currentStage: 'Cross Examination of PW-3 (IO)',
      status: 'Hearing',
      priority: 'urgent',
      description: 'Criminal revision against trial court order refusing bail and framing charges under Sec 307/34 IPC.',
      agreedFee: 175000,
      assignedAdvocate: rajesh._id,
      createdBy: rajesh._id,
    });

    const case3 = await Case.create({
      lawFirmId: lawFirm._id,
      caseNumber: 'FAO (OS) Comm. 88/2024',
      cnrNumber: 'DLHC01-009142-2024',
      title: 'ABC Enterprises vs XYZ Pvt Ltd',
      clientId: abcEnterprises._id,
      clientRepresentation: 'Appellant',
      oppositeParty: 'XYZ Private Limited',
      oppositeCounsel: 'Senior Adv. Harish Salve & Associates',
      caseType: 'Arbitration Petition',
      court: 'Delhi High Court',
      courtroom: 'Bench Courtroom 18',
      judge: "Hon'ble Justice Rajiv Sahai Endlaw",
      filingDate: new Date('2024-06-20'),
      currentHearingDate: new Date(today.getTime() + 14 * 3600 * 1000), // Today 2:00 PM
      currentStage: 'Framing of Issues / Interim Relief (O.39 R.1&2)',
      status: 'Active',
      priority: 'high',
      description: 'First Appeal from Order under Section 37 of Arbitration and Conciliation Act against interim order.',
      agreedFee: 500000,
      assignedAdvocate: ananya._id,
      createdBy: rajesh._id,
    });

    const case4 = await Case.create({
      lawFirmId: lawFirm._id,
      caseNumber: 'CS 1092/2021',
      cnrNumber: 'DLNW01-003412-2021',
      title: 'Kumar vs Singh & Ors',
      clientId: virendraKumar._id,
      clientRepresentation: 'Plaintiff',
      oppositeParty: 'Balvinder Singh & Ors',
      oppositeCounsel: 'Adv. R. K. Tanwar',
      caseType: 'Civil Suit',
      court: 'Rohini District Court',
      courtroom: 'Courtroom No. 09',
      judge: "Hon'ble ADJ Priya Sharma",
      filingDate: new Date('2021-09-12'),
      currentHearingDate: new Date(today.getTime() + 15.75 * 3600 * 1000), // Today 3:45 PM
      currentStage: 'Evidence by Affidavit & Cross',
      status: 'Active',
      priority: 'standard',
      description: 'Suit for partition and separate possession of ancestral residential properties.',
      agreedFee: 150000,
      assignedAdvocate: vikram._id,
      createdBy: ananya._id,
    });

    const case5 = await Case.create({
      lawFirmId: lawFirm._id,
      caseNumber: 'SLP (C) 1920/2026',
      cnrNumber: 'SCIN01-001092-2026',
      title: 'Vivan Steels vs Union of India',
      clientId: vivanSteels._id,
      clientRepresentation: 'Petitioner',
      oppositeParty: 'Union of India & Central Tax Commissioner',
      oppositeCounsel: 'Additional Solicitor General of India',
      caseType: 'Writ Petition (Civil)',
      court: 'Supreme Court of India',
      courtroom: 'Courtroom No. 03 (Chief Court)',
      judge: "Hon'ble Chief Justice of India",
      filingDate: new Date('2026-01-08'),
      currentHearingDate: new Date(today.getTime() + 2 * 24 * 3600 * 1000), // Day after tomorrow
      currentStage: 'Admission & Preliminary Hearing',
      status: 'Active',
      priority: 'high',
      description: 'Special Leave Petition challenging High Court judgment on input tax credit retrospectivity.',
      agreedFee: 600000,
      assignedAdvocate: rajesh._id,
      createdBy: rajesh._id,
    });

    console.log('[SEED] Creating Hearings...');
    await Hearing.create([
      {
        lawFirmId: lawFirm._id,
        caseId: case1._id,
        clientId: rahulSharma._id,
        date: new Date(today.getTime() + 9.5 * 3600 * 1000),
        time: '09:30 AM',
        itemNumber: 'Item 14',
        court: 'Saket District Court',
        courtroom: 'Courtroom No. 12',
        judge: "Hon'ble Judge A. K. Mishra",
        purpose: 'Final Arguments (Part-Heard)',
        benchNotes: 'Plaintiff argued for 45 mins. Defendant counsel seeking passover till 11:30 AM for rejoinder submissions.',
        status: 'InProgress',
        assignedAdvocate: rajesh._id,
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        caseId: case2._id,
        clientId: sunitaDevi._id,
        date: new Date(today.getTime() + 11.25 * 3600 * 1000),
        time: '11:15 AM',
        itemNumber: 'Item 04',
        court: 'Patiala House Courts',
        courtroom: 'Courtroom No. 04',
        judge: "Hon'ble ASJ Vikramjit Singh",
        purpose: 'Cross Examination of PW-3',
        benchNotes: 'Focus on logbook discrepancy between 21:00 hrs and 23:30 hrs.',
        status: 'Scheduled',
        assignedAdvocate: rajesh._id,
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        caseId: case3._id,
        clientId: abcEnterprises._id,
        date: new Date(today.getTime() + 14 * 3600 * 1000),
        time: '02:00 PM',
        itemNumber: 'Item 31',
        court: 'Delhi High Court',
        courtroom: 'Bench Courtroom 18',
        judge: "Hon'ble Justice Rajiv Sahai Endlaw",
        purpose: 'Framing of Issues / Interim Relief',
        benchNotes: 'Press for interim injunction under Order 39 Rules 1 & 2 CPC.',
        status: 'Scheduled',
        assignedAdvocate: ananya._id,
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        caseId: case4._id,
        clientId: virendraKumar._id,
        date: new Date(today.getTime() + 15.75 * 3600 * 1000),
        time: '03:45 PM',
        itemNumber: 'Item 22',
        court: 'Rohini District Court',
        courtroom: 'Courtroom No. 09',
        judge: "Hon'ble ADJ Priya Sharma",
        purpose: 'Evidence by Affidavit & Cross',
        benchNotes: 'Tender DW-1 affidavit in evidence.',
        status: 'Scheduled',
        assignedAdvocate: vikram._id,
        createdBy: ananya._id,
      },
      {
        lawFirmId: lawFirm._id,
        caseId: case5._id,
        clientId: vivanSteels._id,
        date: new Date(today.getTime() + 2 * 24 * 3600 * 1000),
        time: '10:30 AM',
        itemNumber: 'Item 15',
        court: 'Supreme Court of India',
        courtroom: 'Courtroom No. 03 (Chief Court)',
        judge: "Hon'ble Chief Justice of India",
        purpose: 'Notice / Preliminary Hearing',
        benchNotes: 'Senior Advocate Rajesh V. Singhania leading oral arguments.',
        status: 'Scheduled',
        assignedAdvocate: rajesh._id,
        createdBy: rajesh._id,
      },
    ]);

    console.log('[SEED] Creating Tasks...');
    await Task.create([
      {
        lawFirmId: lawFirm._id,
        title: 'Draft Written Statement in Sharma vs Verma',
        description: 'Saket District Court • Limitation Period ends today at 5 PM. Address all paras of preliminary objections.',
        caseId: case1._id,
        clientId: rahulSharma._id,
        category: 'Drafting',
        assignedTo: vikram._id,
        dueDate: new Date(today.getTime() + 17 * 3600 * 1000), // Today 5 PM
        priority: 'Urgent',
        status: 'In Progress',
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        title: 'File Vakalatnama & Rejoinder in ABC Enterprises',
        description: 'Delhi High Court • Registry Counter 4. Ensure original board resolution is attached.',
        caseId: case3._id,
        clientId: abcEnterprises._id,
        category: 'Filings',
        assignedTo: ram._id,
        dueDate: new Date(today.getTime() + 24 * 3600 * 1000 + 11 * 3600 * 1000), // Tomorrow 11 AM
        priority: 'High',
        status: 'To Do',
        createdBy: ananya._id,
      },
      {
        lawFirmId: lawFirm._id,
        title: 'Witness briefing session with client Smt. Sunita Devi',
        description: 'Chambers Conference Room A • State vs Rahul. Prepare witness on timeline of arrest.',
        caseId: case2._id,
        clientId: sunitaDevi._id,
        category: 'Briefing',
        assignedTo: rajesh._id,
        dueDate: new Date(today.getTime() + 2 * 24 * 3600 * 1000),
        priority: 'Medium',
        status: 'To Do',
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        title: 'Pay Court Process Fee (Suit No. CS 1092/2021)',
        description: 'Nazarat Branch • Saket Courts. Obtain stamped receipt for summons.',
        caseId: case4._id,
        clientId: virendraKumar._id,
        category: 'Admin',
        assignedTo: ram._id,
        dueDate: new Date(today.getTime() + 3 * 24 * 3600 * 1000),
        priority: 'Low',
        status: 'To Do',
        createdBy: ananya._id,
      },
    ]);

    console.log('[SEED] Creating Notes...');
    await Note.create([
      {
        lawFirmId: lawFirm._id,
        title: 'Sharma vs Verma — Final Argument Points & Contradictions',
        content: `1. Section 65B Certificate missing for email chain Ex. P-4.\n2. Admission in cross of DW-1 on page 42 regarding signature on delivery challan.\n3. Prima facie title established under Order 39 Rules 1 & 2 CPC.\n4. Irreparable injury caused by continued counterfeit marketing at Mundka warehouse.`,
        category: 'Case',
        caseId: case1._id,
        clientId: rahulSharma._id,
        pinned: true,
        citation: '‘Arjun Panditrao Khotkar vs Kailash Kushanrao Gorantyal’ (2020) 7 SCC 1',
        court: 'Saket District Court',
        judge: "Hon'ble Judge A. K. Mishra",
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        title: 'Leading Case Law on Section 9 Arbitration Act (Interim Relief)',
        content: `Landmark Supreme Court Principles:\n- ‘Adhunik Steels Ltd vs Orissa Manganese’ (2007) 7 SCC 125 — Specific relief standards applied under Sec 9.\n- ‘Essar House Private Limited vs Arcellor Mittal Nippon Steel India Ltd’ (2022) — Proof of actual dissipation of assets not required if strong prima facie case exists.`,
        category: 'Research',
        pinned: true,
        citation: '(2007) 7 SCC 125, (2022) SCC OnLine SC 1219',
        court: 'Supreme Court of India',
        createdBy: ananya._id,
      },
      {
        lawFirmId: lawFirm._id,
        title: 'State vs Rahul — Questions for PW-3 (IO Sub-Inspector) Cross-Examination',
        content: `1. Ask about log book entry discrepancy between 21:00 hrs and 23:30 hrs on date of seizure.\n2. Note absence of independent public witnesses during recovery.\n3. Non-compliance with Section 100(4) CrPC requirements.`,
        category: 'Hearing',
        caseId: case2._id,
        clientId: sunitaDevi._id,
        pinned: false,
        court: 'Patiala House Courts',
        judge: "Hon'ble ASJ Vikramjit Singh",
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        title: 'Client Conference with ABC Enterprises (Managing Director & CFO)',
        content: `Client agreed to propose settlement terms before the sole arbitrator if respondent drops counterclaim of liquidated damages.\nDraft preliminary terms of compromise under Order 23 Rule 3 CPC.`,
        category: 'Meeting',
        caseId: case3._id,
        clientId: abcEnterprises._id,
        pinned: false,
        createdBy: ananya._id,
      },
    ]);

    console.log('[SEED] Creating Payments & Ledger...');
    await Payment.create([
      {
        lawFirmId: lawFirm._id,
        clientId: abcEnterprises._id,
        caseId: case3._id,
        receiptNumber: 'REC-2026-0001',
        amount: 150000,
        paymentDate: new Date(today.getTime() - 24 * 3600 * 1000),
        paymentMethod: 'NEFT',
        transactionReference: 'HDFC UTR#99418241',
        category: 'Appearance Fees',
        description: 'Section 9 Injunction hearing appearance fee & Senior Counsel conference',
        status: 'Realized',
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        clientId: rahulSharma._id,
        caseId: case1._id,
        receiptNumber: 'REC-2026-0002',
        amount: 75000,
        paymentDate: new Date(today.getTime() - 2 * 24 * 3600 * 1000),
        paymentMethod: 'UPI',
        transactionReference: 'UPI/4921004128/ICICI',
        category: 'Retainer Agreements',
        description: 'Trial stage advance retainer installment',
        status: 'Realized',
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        clientId: vivanSteels._id,
        caseId: case5._id,
        receiptNumber: 'REC-2026-0003',
        amount: 120000,
        paymentDate: new Date(today.getTime() - 10 * 24 * 3600 * 1000),
        paymentMethod: 'RTGS',
        transactionReference: 'PNB/RTGS/8812904',
        category: 'Drafting Charges',
        description: 'Special Leave Petition drafting & Senior settlement memo',
        status: 'Pending',
        createdBy: ananya._id,
      },
    ]);

    console.log('[SEED] Creating Expenses...');
    await Expense.create([
      {
        lawFirmId: lawFirm._id,
        caseId: case1._id,
        category: 'Court Fees',
        description: 'Ad-valorem court fees on amended suit valuation',
        amount: 18500,
        expenseDate: new Date(today.getTime() - 3 * 24 * 3600 * 1000),
        paymentMode: 'NetBanking',
        billNumber: 'DCH/E-COURT/90142',
        createdBy: ram._id,
      },
      {
        lawFirmId: lawFirm._id,
        caseId: case3._id,
        category: 'Printing',
        description: 'Paper book binding & compilation of 6 volumes for Division Bench',
        amount: 4200,
        expenseDate: new Date(today.getTime() - 2 * 24 * 3600 * 1000),
        paymentMode: 'Cash',
        billNumber: 'PRNT/CH402/109',
        createdBy: ram._id,
      },
      {
        lawFirmId: lawFirm._id,
        category: 'Travel',
        description: 'Chamber transport for clerk file inspection at Patiala House & Saket',
        amount: 1450,
        expenseDate: new Date(today.getTime() - 24 * 3600 * 1000),
        paymentMode: 'UPI',
        billNumber: '',
        createdBy: ram._id,
      },
    ]);

    console.log('[SEED] Creating Reminders...');
    await Reminder.create([
      {
        lawFirmId: lawFirm._id,
        title: 'Limitation expires for Written Statement in Sharma vs Verma',
        type: 'Limitation',
        relatedCase: case1._id,
        relatedClient: rahulSharma._id,
        reminderDate: new Date(today.getTime() + 17 * 3600 * 1000),
        reminderTime: '05:00 PM',
        priority: 'Urgent',
        completed: false,
        createdBy: rajesh._id,
      },
      {
        lawFirmId: lawFirm._id,
        title: 'Hearing tomorrow in Delhi High Court (Court 18)',
        type: 'Hearing',
        relatedCase: case3._id,
        relatedClient: abcEnterprises._id,
        reminderDate: new Date(today.getTime() + 24 * 3600 * 1000),
        reminderTime: '09:00 AM',
        priority: 'High',
        completed: false,
        createdBy: ananya._id,
      },
    ]);

    console.log('[SEED] Logging Initial Audit Activity...');
    await AuditLog.create({
      lawFirmId: lawFirm._id,
      userId: rajesh._id,
      userName: rajesh.name,
      userEmail: rajesh.email,
      action: 'SYSTEM_SEED',
      entityType: 'Settings',
      entityId: lawFirm._id,
      description: 'Development database seeded with sample chamber roster and docket entries',
      ipAddress: '127.0.0.1',
    });

    console.log('\n=============================================================');
    console.log('  [SEED SUCCESS] Advocate DigiDiary Seed Completed Successfully!');
    console.log('  Firm:       Singhania & Partners LLP');
    console.log('  Admin User: rajesh@singhania.law / Advocate@2026');
    console.log('  Advocate:   ananya@singhania.law / Advocate@2026');
    console.log('  Junior:     vikram@singhania.law / Advocate@2026');
    console.log('  Clerk:      ram@singhania.law    / Advocate@2026');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('[SEED ERROR] Failed to seed database:', err);
    throw err;
  }
};

if (require.main === module) {
  seedData()
    .then(() => disconnectDB().then(() => process.exit(0)))
    .catch(() => process.exit(1));
}

module.exports = seedData;
