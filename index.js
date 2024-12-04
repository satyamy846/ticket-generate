const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');
const app = express();
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

app.use(express.json());
// Multer Setup for File Uploads
const upload = multer({ dest: 'uploads/' });


// Serve HTML Page
app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'upload.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const connection = async () => {
    try {
        await mongoose.connect('mongodb+srv://test-servease:servease@cluster0.j6fx1m3.mongodb.net/cert-ticket?retryWrites=true&w=majority&appName=Cluster0')
        console.log("connected");
    }
    catch (err) {
        console.log("error", err)
    }
}

connection();

const ticketSchema = new mongoose.Schema({
    ticketName: { type: String, required: true },
    ticketNumber: { type: String, required: true, unique: true },
    ticketValid: { type: Boolean, default: false },
    image: { type: String },
});
const Ticket = mongoose.model('Ticket', ticketSchema);



app.post('/upload-tickets', upload.single('file'), async (req, res) => {
    try {
        const filePath = req.file.path;

        // Read Excel File
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        // Validate and Prepare Tickets
        const tickets = await Promise.all(
            data.map(async (row) => {
                const ticket = {
                    ticketName: row.ticketName,
                    ticketNumber: row.ticketNumber,
                };

                // Generate QR Code as Data URL
                const qrCodeData = await QRCode.toDataURL('https://ticket-generate.onrender.com/validate-ticket'+ ticket.ticketNumber);
                ticket.image = qrCodeData; // Save QR code image as base64

                return ticket;
            })
        );

        // Insert Many Tickets
        await Ticket.insertMany(tickets, { ordered: false });

        // Delete the uploaded file after processing
        fs.unlinkSync(filePath);

        res.status(201).send({ message: 'Tickets uploaded and QR codes generated successfully' });
    } catch (error) {
        console.log(error)
        if (error.code === 11000) {
            return res.status(400).send({ error: 'Duplicate ticket number found' });
        }
        res.status(500).send({ error: 'Failed to upload tickets', details: error });
    }
});

app.get('/validate-ticket/:ticketNumber', async (req, res) => {
    try {
        const { ticketNumber } = req.params;
        const ticket = await Ticket.findOne({ ticketNumber });

        if (ticket) {
            return res.status(200).send({ message: 'Ticket is valid', ticket });
        } else {
            return res.status(404).send({ error: 'Ticket not found' });
        }
    } catch (error) {
        res.status(500).send({ error: 'Error validating ticket', details: error });
    }
});

app.patch('/validate-ticket/:ticketNumber', async (req, res) => {
    try {
        const { ticketNumber } = req.params;
        const ticket = await Ticket.findOne({ ticketNumber });

        if (!ticket?.ticketValid) {
            
            ticket.ticketValid = true;
            await ticket.save();
            return res.status(200).send({ message: 'Ticket validated successfully', ticket });
        } else {
            return res.status(404).send({ error: 'Ticket not found' });
        }
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: 'Error validating ticket', details: error });
    }
});

app.listen(3000, () => {
    console.log('Example app listening on port 3000!');
});