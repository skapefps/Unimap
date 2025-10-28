const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'arthurroquemeloneiva@gmail.com',
        pass: 'ciuh jipe kfxq jkug'
    }
});

// Verificar configuração do email
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Erro na configuração do email:', error);
    } else {
        console.log('✅ Servidor de email configurado com sucesso');
    }
});

module.exports = transporter;