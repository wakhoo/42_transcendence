import requests

headers = {
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsImVtYWlsIjoiYkBiLmZyIiwiaWF0IjoxNzg3MTYwNzUxLCJleHAiOjE3ODcxNjQzNTF9.FD2dYRDtQS64DnCUSsrYEUp_m3an1gjB8AaikDwrkKY',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'Origin': 'https://localhost:8443',
    'Referer': 'https://localhost:8443/dashboard',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
}

json_data = {
    'avatarUrl': '/avatars/avatar19.png',
}

response = requests.patch('https://localhost:8443/api/user/me', headers=headers, json=json_data, verify=False)

# Note: json_data will not be serialized by requests
# exactly as it was in the original request.
#data = '{"avatarUrl":"/avatars/avatar19.png"}'
#response = requests.patch('https://localhost:8443/api/user/me', headers=headers, data=data, verify=False)

print(response);