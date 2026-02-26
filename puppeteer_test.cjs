const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.error('ERROR:', err.message));

    await page.goto('https://instantmeeting-ten.vercel.app', { waitUntil: 'networkidle0' });

    const content = await page.content();
    console.log("HTML:", content);

    await browser.close();
})();
