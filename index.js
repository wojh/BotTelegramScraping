const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();  

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const COOKIES_PATH = 'cookies.json';

async function saveCookies(page) {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('Cookies salvos com sucesso!');
}

async function loadCookies(page) {
    if (fs.existsSync(COOKIES_PATH)) {
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
        await page.setCookie(...cookies);
        console.log('Cookies carregados com sucesso!');
    }
}

const login = async(page, link) => {

    await new Promise(resolve => setTimeout(resolve, 1000)); 
    // Navegue até a página do vídeo
    await page.goto(link); 

    //await page.waitForSelector('.head__btn.head__btn--connection.head__btn--login.btn-clear');
    await page.waitForSelector('.head__btn--login');
    await page.click('.head__btn--login'); 

    await page.waitForSelector('#signin-form_login');
    await page.type('#signin-form_login', process.env.USERNAME);
    await page.waitForSelector('#signin-form_password');
    await page.type('#signin-form_password', process.env.PASSWORD);
    await page.keyboard.press('Enter');
    
    await page.waitForNavigation({ waitUntil: 'networkidle0' }); // Aguarde até que a navegação termine 
    await saveCookies(page); 
}


const delay = async (ms) => { 
    return new Promise(rsv => setTimeout(rsv,ms));
}

const downloadVid = async(link, userId, ctx)=>{
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized'],
        executablePath: '/usr/bin/google-chrome'
    });
    
    const page = await browser.newPage();
    try{
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        if (fs.existsSync(COOKIES_PATH)) {
            await loadCookies(page);
            await page.goto(process.env.SITE_NAME, { waitUntil: 'networkidle0' });
            console.log('Login com cookies carregados.');
            ctx.reply('já logado com os cookies.');
        } else { 
            ctx.reply('não logado ainda. Vamos fazer agora.');
            await login(page, link); 
            ctx.reply('login efetuado com sucesso.'); 
        }

        // Navegue até a página do vídeo
        await page.goto(link); 

        // já está logado. Agora podemos procurar o seletor do botão de baixar o vídeo 
        // Interaja com a página para iniciar o download do vídeo
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Esperando seletor .dl.tab-button');
        await page.waitForSelector('.dl.tab-button');
        console.log('Clicando no seletor .dl.tab-button');
        await page.click('.dl.tab-button');

        // Aguarde 3 segundos para o carregamento do seletor 'a .video-hd-mark'
        console.log('Aguardando 3 segundos para o carregamento do seletor a .video-hd-mark e do .video-sd-mark ');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('pós carregamento');
        ctx.reply('Vídeo encontrado.');
        await page.evaluate(() => {
            const element1080p = document.querySelector('a .video-hd-mark');
            const element360p = document.querySelector('a .video-sd-mark');
            if (element1080p) {
                console.log('Clicando no seletor de 1080p');
                element1080p.click();
            } else if(element360p){
                console.log('Clicando no seletor de 360p');
                element360p.click(); 
            } else { 
                throw new Error('Elemento não encontrado');
            }
        });
        ctx.reply('Download Iniciado.'); 
    }
    catch (err){
        console.error(`Algum erro: ${err}`);
        ctx.reply(`Algum erro: ${err}`)
        await browser.close();
    }  

    return 'Retorno da função: ok';

} 

//console.log(downloadVid('https://www.xvideos.com/video.ucoptav6bc1/baiano_dotado_arregacando_novinha_do_bairro'));
bot.start((ctx) => ctx.reply(`Bem-vindo ao bot do ${process.env.SITE_NAME}! Envie um link de vídeo para baixar.`));

bot.on('text', async (ctx) => {
    const link = ctx.message.text;
    const userId = ctx.message.from.id;
    const result = await downloadVid(link, userId, ctx);
    ctx.reply(result);
});


try {
    bot.launch();
    console.log('Bot está funcionando!');
} catch (error) {
    console.error('Erro ao iniciar o bot:', error);
}

// Gerenciar erros do Puppeteer
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
