import requests

headers = {
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImVtYWlsIjoiYkBiLmZyIiwiaWF0IjoxNzg3MTYwNzUxLCJleHAiOjE3ODcxNjQzNTF9.FD2dYRDtQS64DnCUSsrYEUp_m3an1gjB8AaikDwrkKY',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'Referer': 'https://localhost:8443/dashboard',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
}


response = requests.get('https://localhost:8443/api/chat/friends/pending', headers=headers, verify=False)

print(response);