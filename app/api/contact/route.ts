import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

export async function POST(req: NextRequest) {
  try {
    // Extrair os dados do corpo da requisição
    const { name, email, message } = await req.json();

    // Validar os dados
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Nome, email e mensagem são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar formato de email com regex básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      );
    }

    // // Configurar o transporte do nodemailer
    // // Nota: Em produção, você deve usar variáveis de ambiente para credenciais
    // const transporter = nodemailer.createTransport({
    //   service: 'gmail', // Você pode usar outro serviço de email
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASSWORD
    //   }
    // });

    // // Configurar o email
    // const mailOptions = {
    //   from: email,
    //   to: process.env.EMAIL_RECIPIENT || 'seu-email@gmail.com', // Substitua pelo seu email
    //   subject: `Nova mensagem de contato de ${name}`,
    //   text: message,
    //   html: `
    //     <div>
    //       <h2>Nova mensagem de contato</h2>
    //       <p><strong>Nome:</strong> ${name}</p>
    //       <p><strong>Email:</strong> ${email}</p>
    //       <p><strong>Mensagem:</strong></p>
    //       <p>${message.replace(/\n/g, '<br>')}</p>
    //     </div>
    //   `
    // };
    // await transporter.sendMail(mailOptions);

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string);
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    // Enviar notificação para o Telegram
    if (telegramChatId) {
      const telegramMessage = `Nova mensagem de contato:\nNome: ${name}\nEmail: ${email}\nMensagem: ${message}`;
      await bot.telegram.sendMessage(telegramChatId, telegramMessage);
    }

    // Retornar resposta de sucesso
    return NextResponse.json(
      { success: true, message: 'Mensagem enviada com sucesso!' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar mensagem. Tente novamente mais tarde.' },
      { status: 500 }
    );
  }
}
