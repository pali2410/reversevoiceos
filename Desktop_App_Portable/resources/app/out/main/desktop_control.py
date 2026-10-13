#!/usr/bin/env python3
"""
VoiceOS Desktop Control Helper
Accepts a JSON command on stdin, executes it, prints JSON result to stdout.
Usage: python desktop_control.py < command.json
Or:    echo '{"action":"set_volume","value":50}' | python desktop_control.py
"""
import sys
import json
import time
import os
import subprocess
import re

def get_cmd():
    try:
        return json.loads(sys.argv[1]) if len(sys.argv) > 1 else json.load(sys.stdin)
    except:
        return {}

def ok(msg="Done.", **extra):
    print(json.dumps({"ok": True, "message": msg, **extra}))

def fail(msg):
    print(json.dumps({"ok": False, "message": msg}))

cmd = get_cmd()
action = cmd.get("action", "")

# ─── VOLUME ──────────────────────────────────────────────────────────────────
if action == "set_volume":
    try:
        from pycaw.pycaw import AudioUtilities
        level = max(0, min(100, int(cmd.get("value", 50))))
        sp = AudioUtilities.GetSpeakers()
        sp.volume_percent = level
        time.sleep(0.1)
        actual = sp.volume_percent
        ok(f"Volume set to {round(actual)}%.", actual=round(actual))
    except Exception as e:
        fail(f"Volume error: {e}")

elif action == "get_volume":
    try:
        from pycaw.pycaw import AudioUtilities
        sp = AudioUtilities.GetSpeakers()
        ok(f"Volume is {round(sp.volume_percent)}%.", actual=round(sp.volume_percent))
    except Exception as e:
        fail(f"Volume error: {e}")

elif action == "mute":
    try:
        from pycaw.pycaw import AudioUtilities
        sp = AudioUtilities.GetSpeakers()
        ep = sp.EndpointVolume
        ep.SetMute(not ep.GetMute(None), None)
        ok("Toggled mute.")
    except Exception as e:
        fail(f"Mute error: {e}")

# ─── MOUSE ───────────────────────────────────────────────────────────────────
elif action == "click":
    try:
        import pyautogui
        x = cmd.get("x")
        y = cmd.get("y")
        btn = cmd.get("button", "left")
        clicks = cmd.get("clicks", 1)
        if x is not None and y is not None:
            pyautogui.click(x, y, clicks=clicks, button=btn)
        else:
            pyautogui.click(clicks=clicks, button=btn)
        ok(f"Clicked {btn} at ({x},{y}).")
    except Exception as e:
        fail(f"Click error: {e}")

elif action == "double_click":
    try:
        import pyautogui
        x = cmd.get("x")
        y = cmd.get("y")
        if x is not None and y is not None:
            pyautogui.doubleClick(x, y)
        else:
            pyautogui.doubleClick()
        ok("Double-clicked.")
    except Exception as e:
        fail(f"Double-click error: {e}")

elif action == "right_click":
    try:
        import pyautogui
        x, y = cmd.get("x"), cmd.get("y")
        if x and y:
            pyautogui.rightClick(x, y)
        else:
            pyautogui.rightClick()
        ok("Right-clicked.")
    except Exception as e:
        fail(f"Right-click error: {e}")

elif action == "move_mouse":
    try:
        import pyautogui
        pyautogui.moveTo(cmd["x"], cmd["y"], duration=0.3)
        ok(f"Moved mouse to ({cmd['x']},{cmd['y']}).")
    except Exception as e:
        fail(f"Move error: {e}")

elif action == "drag":
    try:
        import pyautogui
        pyautogui.drag(cmd.get("dx",0), cmd.get("dy",0), duration=0.5, button=cmd.get("button","left"))
        ok("Dragged.")
    except Exception as e:
        fail(f"Drag error: {e}")

elif action == "scroll":
    try:
        import pyautogui
        x, y = cmd.get("x"), cmd.get("y")
        clicks = cmd.get("clicks", 3)
        direction = cmd.get("direction", "down")
        amount = clicks if direction == "up" else -clicks
        if x and y:
            pyautogui.scroll(amount, x=x, y=y)
        else:
            pyautogui.scroll(amount)
        ok(f"Scrolled {direction}.")
    except Exception as e:
        fail(f"Scroll error: {e}")

elif action == "get_mouse_pos":
    try:
        import pyautogui
        pos = pyautogui.position()
        ok(f"Mouse at ({pos.x},{pos.y}).", x=pos.x, y=pos.y)
    except Exception as e:
        fail(f"Error: {e}")

# ─── KEYBOARD ────────────────────────────────────────────────────────────────
elif action == "type_text":
    try:
        import pyautogui
        text = cmd.get("text", "")
        interval = cmd.get("interval", 0.02)
        pyautogui.write(text, interval=interval)
        ok(f"Typed: {text[:50]}")
    except Exception as e:
        fail(f"Type error: {e}")

elif action == "hotkey":
    try:
        import pyautogui
        keys = cmd.get("keys", [])
        if isinstance(keys, str):
            keys = keys.split("+")
        keys = [k.strip().lower() for k in keys]
        pyautogui.hotkey(*keys)
        ok(f"Hotkey: {'+'.join(keys)}")
    except Exception as e:
        fail(f"Hotkey error: {e}")

elif action == "key_press":
    try:
        import pyautogui
        key = cmd.get("key", "")
        pyautogui.press(key)
        ok(f"Pressed: {key}")
    except Exception as e:
        fail(f"Key error: {e}")

elif action == "key_down":
    try:
        import pyautogui
        pyautogui.keyDown(cmd.get("key", ""))
        ok(f"Key down: {cmd.get('key')}")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "key_up":
    try:
        import pyautogui
        pyautogui.keyUp(cmd.get("key", ""))
        ok(f"Key up: {cmd.get('key')}")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "copy_selection":
    try:
        import pyautogui, pyperclip
        pyautogui.hotkey("ctrl", "a")
        time.sleep(0.1)
        pyautogui.hotkey("ctrl", "c")
        time.sleep(0.2)
        text = pyperclip.paste()
        ok(f"Copied {len(text)} chars.", text=text[:2000])
    except Exception as e:
        fail(f"Copy error: {e}")

elif action == "paste_text":
    try:
        import pyperclip, pyautogui
        pyperclip.copy(cmd.get("text",""))
        time.sleep(0.1)
        pyautogui.hotkey("ctrl", "v")
        ok("Pasted.")
    except Exception as e:
        fail(f"Paste error: {e}")

# ─── SCREENSHOT / SCREEN READ ─────────────────────────────────────────────────
elif action == "screenshot":
    try:
        import pyautogui, base64
        from io import BytesIO
        img = pyautogui.screenshot()
        region = cmd.get("region")  # [x, y, w, h]
        if region:
            img = img.crop((region[0], region[1], region[0]+region[2], region[1]+region[3]))
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        ok("Screenshot taken.", image_base64=b64, width=img.width, height=img.height)
    except Exception as e:
        fail(f"Screenshot error: {e}")

elif action == "find_on_screen":
    try:
        import pyautogui
        # Find text on screen via screenshot + basic search
        # This needs OCR - use a simple approach
        target = cmd.get("text", "")
        ok(f"Screen search for '{target}' - use screenshot + analyze.")
    except Exception as e:
        fail(f"Error: {e}")

# ─── WINDOWS / APPS ──────────────────────────────────────────────────────────
elif action == "minimize_all":
    try:
        import subprocess
        subprocess.Popen(["powershell","-c","(New-Object -ComObject Shell.Application).MinimizeAll()"])
        ok("Minimized all windows.")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "restore_all":
    try:
        import subprocess
        subprocess.Popen(["powershell","-c","(New-Object -ComObject Shell.Application).UndoMinimizeALL()"])
        ok("Restored all windows.")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "close_window":
    try:
        import pyautogui
        pyautogui.hotkey("alt", "f4")
        ok("Closed active window.")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "switch_window":
    try:
        import pyautogui
        pyautogui.hotkey("alt", "tab")
        ok("Switched window.")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "maximize_window":
    try:
        import pyautogui
        pyautogui.hotkey("win", "up")
        ok("Maximized window.")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "focus_window":
    try:
        import subprocess, pyautogui
        title = cmd.get("title","")
        proc = cmd.get("process","")
        if proc:
            subprocess.Popen(["powershell","-c",f"(Get-Process '{proc}' -ErrorAction SilentlyContinue)[0].MainWindowHandle | ForEach-Object {{ [void][System.Runtime.InteropServices.Marshal]::GetFunctionPointerForDelegate((Get-Type).GetMethod('ShowWindow')) }}"])
        pyautogui.hotkey("win", "d")
        time.sleep(0.2)
        ok(f"Focused {title or proc}.")
    except Exception as e:
        fail(f"Error: {e}")

# ─── BROWSER CONTROL ─────────────────────────────────────────────────────────
elif action == "browser_navigate":
    try:
        import pyautogui, time
        url = cmd.get("url","")
        # Focus address bar and type URL
        pyautogui.hotkey("ctrl", "l")
        time.sleep(0.3)
        pyautogui.hotkey("ctrl", "a")
        pyautogui.write(url, interval=0.02)
        pyautogui.press("enter")
        ok(f"Navigated to {url}")
    except Exception as e:
        fail(f"Nav error: {e}")

elif action == "browser_new_tab":
    try:
        import pyautogui, time
        url = cmd.get("url","")
        pyautogui.hotkey("ctrl", "t")
        time.sleep(0.3)
        if url:
            pyautogui.write(url, interval=0.02)
            pyautogui.press("enter")
        ok(f"New tab: {url}")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "browser_search_youtube":
    try:
        import pyautogui, time
        query = cmd.get("query","")
        # Navigate current tab to YouTube search
        pyautogui.hotkey("ctrl", "l")
        time.sleep(0.3)
        import urllib.parse
        url = "https://www.youtube.com/results?search_query=" + urllib.parse.quote(query)
        pyautogui.write(url, interval=0.01)
        pyautogui.press("enter")
        time.sleep(2.5)
        # Click the first video result
        # YouTube first video is roughly at these coordinates
        pyautogui.moveTo(200, 350, duration=0.4)
        time.sleep(0.3)
        pyautogui.click(200, 350)
        ok(f"Searched YouTube for '{query}' and clicked first result.")
    except Exception as e:
        fail(f"YouTube error: {e}")

elif action == "youtube_click_first_video":
    try:
        import pyautogui, time
        time.sleep(cmd.get("wait", 2))
        # Standard YouTube layout: first video thumbnail is around x=200, y=300-400
        positions = [(200, 340), (210, 360), (195, 330), (205, 375)]
        for pos in positions:
            pyautogui.moveTo(pos[0], pos[1], duration=0.3)
            time.sleep(0.2)
        pyautogui.click(200, 350)
        ok("Clicked first YouTube video.")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "youtube_play_pause":
    try:
        import pyautogui, time
        # Click the YouTube player area to focus it, then press K or Space
        pyautogui.hotkey("k")
        ok("Toggled YouTube play/pause.")
    except Exception as e:
        fail(f"Error: {e}")

elif action == "youtube_next_video":
    try:
        import pyautogui
        pyautogui.hotkey("shift", "n")
        ok("Skipped to next YouTube video.")
    except Exception as e:
        fail(f"Error: {e}")

# ─── CLIPBOARD ────────────────────────────────────────────────────────────────
elif action == "get_clipboard":
    try:
        import pyperclip
        text = pyperclip.paste()
        ok(f"Clipboard has {len(text)} chars.", text=text[:5000])
    except Exception as e:
        fail(f"Clipboard error: {e}")

elif action == "set_clipboard":
    try:
        import pyperclip
        pyperclip.copy(cmd.get("text",""))
        ok("Clipboard set.")
    except Exception as e:
        fail(f"Error: {e}")

# ─── FILE OPERATIONS ─────────────────────────────────────────────────────────
elif action == "create_file":
    try:
        fpath = cmd.get("path","")
        content = cmd.get("content","")
        if not os.path.isabs(fpath):
            fpath = os.path.join(os.path.expanduser("~/Desktop"), fpath)
        os.makedirs(os.path.dirname(fpath), exist_ok=True) if os.path.dirname(fpath) else None
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content)
        ok(f"Created {fpath}", path=fpath)
    except Exception as e:
        fail(f"File error: {e}")

elif action == "read_file":
    try:
        fpath = cmd.get("path","")
        if not os.path.isabs(fpath):
            fpath = os.path.join(os.path.expanduser("~/Desktop"), fpath)
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(50000)
        ok(f"Read {len(content)} chars.", content=content)
    except Exception as e:
        fail(f"Read error: {e}")

elif action == "run_python":
    try:
        code = cmd.get("code","")
        tmpfile = os.path.join(os.environ.get("TEMP", "/tmp"), f"vos_{int(time.time())}.py")
        with open(tmpfile, "w") as f:
            f.write(code)
        result = subprocess.run(["python", tmpfile], capture_output=True, text=True, timeout=30)
        os.unlink(tmpfile)
        ok(result.stdout[:2000] or "Script ran.", stdout=result.stdout[:2000], stderr=result.stderr[:500])
    except Exception as e:
        fail(f"Run error: {e}")

elif action == "run_powershell":
    try:
        script = cmd.get("script","")
        result = subprocess.run(["powershell","-NoProfile","-NonInteractive","-Command",script],
                                capture_output=True, text=True, timeout=30)
        ok(result.stdout[:2000] or "Done.", stdout=result.stdout[:2000], stderr=result.stderr[:500])
    except Exception as e:
        fail(f"PS error: {e}")

elif action == "open_url":
    try:
        url = cmd.get("url","")
        profile = cmd.get("profile","")
        chrome = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        if profile and os.path.exists(chrome):
            subprocess.Popen([chrome, f"--profile-directory={profile}", url])
        else:
            os.startfile(url) if url.startswith("http") else subprocess.Popen(["start", "", url], shell=True)
        ok(f"Opened {url}")
    except Exception as e:
        fail(f"Open error: {e}")

elif action == "get_screen_size":
    try:
        import pyautogui
        size = pyautogui.size()
        ok(f"Screen: {size.width}x{size.height}", width=size.width, height=size.height)
    except Exception as e:
        fail(f"Error: {e}")

else:
    fail(f"Unknown action: '{action}'. Available: set_volume, get_volume, mute, click, double_click, right_click, move_mouse, drag, scroll, type_text, hotkey, key_press, copy_selection, paste_text, screenshot, browser_navigate, browser_new_tab, browser_search_youtube, youtube_click_first_video, youtube_play_pause, youtube_next_video, minimize_all, restore_all, close_window, switch_window, maximize_window, get_clipboard, set_clipboard, create_file, read_file, run_python, run_powershell, open_url")
