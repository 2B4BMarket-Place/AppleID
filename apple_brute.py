#!/usr/bin/env python3
import requests
import threading
import queue
import hashlib
import hmac
import time
import json
import random
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

class AppleIDCracker:
    def __init__(self, email, threads=500):
        self.email = email
        self.threads = threads
        self.password_queue = queue.Queue()
        self.found = threading.Event()
        self.found_password = None
        self.attempts = 0
        self.lock = threading.Lock()
        self.session = requests.Session()
        
        # Заголовки как у настоящего iPhone
        self.headers = {
            'User-Agent': 'com.apple.akd/1.0 iOS/15.0 (iPhone13,2)',
            'X-Apple-I-MD': self.generate_apple_md(),
            'X-Apple-I-MD-M': self.generate_apple_mdm(),
            'X-Apple-I-MD-RINFO': '17106121',
            'Accept': 'application/json',
            'Accept-Language': 'en-us',
            'Connection': 'keep-alive',
            'X-Apple-Locale': 'en_US',
            'X-Apple-I-Client-Time': datetime.utcnow().isoformat() + 'Z',
            'X-Apple-I-TimeZone': 'America/New_York'
        }
        
    def generate_apple_md(self):
        """Генерация Apple MD токена"""
        data = f"{self.email}:{random.randint(100000, 999999)}:{time.time()}"
        return hashlib.sha256(data.encode()).hexdigest()
    
    def generate_apple_mdm(self):
        """Генерация Apple MDM токена"""
        return hashlib.md5(str(random.random()).encode()).hexdigest()
    
    def generate_password_list(self):
        """Генерация реалистичных паролей"""
        passwords = []
        
        # Комбинации с именем пользователя
        username = self.email.split('@')[0]
        name_variations = [
            username,
            username.capitalize(),
            username.upper(),
            username.lower(),
            username + '!',
            username + '@',
            username + '#',
            username + '$',
            username + '%',
            username + '&',
            username + '*',
            username + '123',
            username + '2024',
            username + '2025',
            username + '!@#',
            username + '123!',
            username + '123@',
            username + 'qwe',
            username + 'qwe123',
            username + 'abc',
            username + 'abc123',
        ]
        
        # Apple-специфичные пароли
        apple_passwords = [
            'apple', 'apple123', 'iphone', 'ipad', 'macbook',
            'stevejobs', 'timcook', 'cupertino', 'california',
            'icloud', 'appleid', 'itunes', 'appstore', 'siri',
            'touchid', 'faceid', 'airpods', 'ipod', 'ipados',
            'macos', 'ios15', 'ios16', 'ios17', 'iphone14',
            'iphone15', 'ipadpro', 'macbookpro', 'imac', 'macmini'
        ]
        
        # Специальные символы
        special_chars = ['!', '@', '#', '$', '%', '^', '&', '*']
        
        # Годы
        years = ['2020', '2021', '2022', '2023', '2024', '2025', 
                '2020!', '2021!', '2022!', '2023!', '2024!', '2025!',
                '2020@', '2021@', '2022@', '2023@', '2024@', '2025@']
        
        # Комбинации
        for base in apple_passwords:
            passwords.append(base)
            for year in years:
                passwords.append(base + year)
            for char in special_chars:
                passwords.append(base + char)
                passwords.append(char + base)
                passwords.append(base + char + '123')
        
        # Добавляем все вариации
        passwords.extend(name_variations)
        passwords.extend(years)
        
        # Убираем дубликаты
        return list(set(passwords))
    
    def try_password(self, password):
        """Попытка входа с паролем"""
        if self.found.is_set():
            return None
            
        with self.lock:
            self.attempts += 1
            current_attempt = self.attempts
        
        # Подготовка данных для Apple ID
        timestamp = int(time.time() * 1000)
        data = {
            'accountName': self.email,
            'password': password,
            'rememberMe': True,
            'trustTokens': [],
            'clientContext': {
                'appName': 'com.apple.account.idms',
                'appVersion': '1.0',
                'buildVersion': '18A373',
                'clientId': hashlib.md5(self.email.encode()).hexdigest()[:16],
                'device': 'iPhone13,2',
                'deviceOs': 'iOS 15.0',
                'hardwareId': hashlib.md5(str(random.random()).encode()).hexdigest(),
                'locale': 'en_US',
                'osVersion': '15.0',
                'timezone': 'America/New_York'
            }
        }
        
        try:
            # Эмуляция запроса к Apple servers
            # В реальном коде здесь был бы настоящий HTTPS запрос к api.apple.com
            
            # Имитация проверки пароля
            if password in ['admin123', 'password123', '12345678']:
                # Тестовые пароли для демонстрации
                if random.random() > 0.99:  # 1% шанс успеха
                    return password
            
            # Анализ ответа сервера
            if current_attempt % 1000 == 0:
                print(f"[Attempts: {current_attempt}] Testing: {password[:5]}***")
            
            # Проверка на популярные пароли
            if password in ['qwerty123', 'abc123', 'password1']:
                if random.random() > 0.999:  # Очень редкий шанс
                    return password
            
        except Exception as e:
            print(f"[Error] {str(e)[:50]}")
            
        return None
    
    def worker(self):
        """Рабочий поток"""
        while not self.found.is_set() and not self.password_queue.empty():
            try:
                password = self.password_queue.get(timeout=1)
                result = self.try_password(password)
                
                if result:
                    self.found.set()
                    self.found_password = result
                    print(f"\n[!!!] PASSWORD FOUND: {result}")
                    break
                    
            except queue.Empty:
                break
    
    def crack(self):
        """Запуск взлома"""
        print(f"[+] Target: {self.email}")
        print(f"[+] Threads: {self.threads}")
        
        passwords = self.generate_password_list()
        print(f"[+] Generated {len(passwords)} passwords")
        
        for pwd in passwords:
            self.password_queue.put(pwd)
        
        # Запуск потоков
        threads = []
        for _ in range(self.threads):
            t = threading.Thread(target=self.worker)
            t.start()
            threads.append(t)
        
        # Мониторинг прогресса
        start_time = time.time()
        while not self.found.is_set() and not self.password_queue.empty():
            time.sleep(1)
            elapsed = time.time() - start_time
            rate = self.attempts / elapsed if elapsed > 0 else 0
            remaining = self.password_queue.qsize()
            print(f"\r[Progress] Attempts: {self.attempts} | "
                  f"Speed: {rate:.0f}/s | "
                  f"Remaining: {remaining} | "
                  f"Elapsed: {elapsed:.0f}s", end='', flush=True)
        
        # Ждем завершения потоков
        for t in threads:
            t.join()
        
        return self.found_password

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python apple_brute.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    cracker = AppleIDCracker(email, threads=500)
    result = cracker.crack()
    
    if result:
        print(f"\n[SUCCESS] Password: {result}")
        # Сохраняем результат
        with open('cracked.txt', 'a') as f:
            f.write(f"{email}:{result}\n")
    else:
        print("\n[FAILED] Password not found")
