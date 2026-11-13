const nodemailer = require('nodemailer');

const { SMTP_USER, SMTP_PASS } = process.env;

const emailHabilitado = Boolean(SMTP_USER && SMTP_PASS);

if (!emailHabilitado) {
    console.warn('⚠️  SMTP_USER/SMTP_PASS ausentes — envio de email desabilitado.');
}

// Transporter real quando há credenciais; stub que falha de forma explícita quando não há.
const transporter = emailHabilitado
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
    : {
        sendMail: (_opts, callback) => {
            const erro = new Error('Envio de email não configurado (SMTP_USER/SMTP_PASS ausentes)');
            if (typeof callback === 'function') return callback(erro);
            return Promise.reject(erro);
        },
        verify: (callback) => {
            if (typeof callback === 'function') callback(null, false);
        }
    };

// Só verifica a conexão fora de teste, e apenas se houver credenciais.
if (emailHabilitado && process.env.NODE_ENV !== 'test') {
    transporter.verify((error) => {
        if (error) {
            console.error('❌ Erro na configuração do email:', error.message);
        } else {
            console.log('✅ Servidor de email configurado');
        }
    });
}

module.exports = transporter;
module.exports.emailHabilitado = emailHabilitado;
