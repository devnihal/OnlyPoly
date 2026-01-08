# ONLYPOLY - How to Connect & Play (LAN Multiplayer)

## 🎮 Quick Start Guide

### **Step 1: Start the Server (Host Device)**

1. Open **PowerShell** or **Command Prompt** on your Windows PC/laptop
2. Navigate to the OnlyPoly folder:
   ```powershell
   cd C:\Users\mator\Desktop\OnlyPoly
   ```
3. Start the server:
   ```powershell
   npm start
   ```
4. You should see:
   ```
   ONLYPOLY server running on http://0.0.0.0:3000
   ```

---

### **Step 2: Find Your Local IP Address (Host Device)**

**On Windows:**

**Method 1 - PowerShell (Easiest):**
```powershell
ipconfig | findstr IPv4
```

Look for the line that shows your **Wi-Fi adapter** (not Ethernet). It will look like:
```
IPv4 Address. . . . . . . . . . . . : 192.168.1.105
```

**Method 2 - Settings App:**
1. Press `Windows + I` to open Settings
2. Go to **Network & Internet** → **Wi-Fi**
3. Click on your connected Wi-Fi network
4. Scroll down to find **IPv4 address** (e.g., `192.168.1.105`)

**Method 3 - Command Prompt:**
```cmd
ipconfig
```
Look for **Wireless LAN adapter Wi-Fi** section and find **IPv4 Address**

---

### **Step 3: Connect All Devices to Same Wi-Fi**

✅ **CRITICAL:** All devices (host PC + all phones/tablets) **MUST** be on the **same Wi-Fi network**.

- Make sure your phone is connected to the **same Wi-Fi** as your PC
- Check Wi-Fi name matches on both devices
- If using mobile hotspot, connect all devices to that hotspot

---

### **Step 4: Join from Other Devices**

**On each phone/tablet/other device:**

1. Open any web browser (Chrome, Safari, Firefox, etc.)
2. Type this URL in the address bar:
   ```
   http://YOUR_IP_ADDRESS:3000
   ```
   
   **Example:** If your IP is `192.168.1.105`, type:
   ```
   http://192.168.1.105:3000
   ```

3. Press **Enter** or **Go**
4. You should see the ONLYPOLY lobby screen!

---

## 📱 Common Issues & Solutions

### ❌ **"Can't connect" or "Connection refused"**

**Check:**
- ✅ Server is running (`npm start` shows the message)
- ✅ All devices on **same Wi-Fi network**
- ✅ IP address is correct (check with `ipconfig` again)
- ✅ Windows Firewall might be blocking port 3000

**Fix Windows Firewall:**
1. Open **Windows Defender Firewall**
2. Click **Advanced settings**
3. Click **Inbound Rules** → **New Rule**
4. Select **Port** → **TCP** → **Specific local ports: 3000**
5. Allow the connection → Apply to all profiles → Name it "ONLYPOLY"

### ❌ **"This site can't be reached"**

- Make sure you typed `http://` (not `https://`)
- Make sure you included `:3000` at the end
- Double-check the IP address

### ❌ **Phone connects but game doesn't work**

- Make sure server console shows no errors
- Refresh the browser page
- Check that all players are on the same Wi-Fi

---

## 🌐 Example Connection URLs

If your local IP is **192.168.1.105**, use:
```
http://192.168.1.105:3000
```

If your local IP is **10.0.0.5**, use:
```
http://10.0.0.5:3000
```

If your local IP is **172.16.0.12**, use:
```
http://172.16.0.12:3000
```

**Format:** `http://[YOUR_IP]:3000`

---

## 🎯 Quick Reference

| Step | Action | Device |
|------|--------|--------|
| 1 | Run `npm start` | Host PC |
| 2 | Find IP with `ipconfig` | Host PC |
| 3 | Connect to Wi-Fi | All devices |
| 4 | Open `http://[IP]:3000` | All phones/devices |

---

## 💡 Pro Tips

- **Keep the server console open** - You'll see connection logs there
- **Use a stable Wi-Fi** - Avoid public/open networks (they often block device-to-device communication)
- **Test with 2 devices first** - Make sure it works before inviting more players
- **Host device should stay on** - If the PC running the server turns off/sleeps, the game stops

---

## 🚀 Ready to Play!

Once everyone is connected:
1. Each player enters their **display name** and clicks **Join**
2. Toggle **Ready** button
3. When **≥2 players are ready**, the **HOST** clicks **Start Game**
4. Enjoy ONLYPOLY! 🎲

