"""Verify homepage terminal power transitions and fresh Bash state."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import re
from playwright.sync_api import expect, sync_playwright


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


dist = Path(__file__).resolve().parents[1] / 'dist'
with ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(dist))) as server, sync_playwright() as pw:
    Thread(target=server.serve_forever, daemon=True).start()
    browser = pw.chromium.launch(executable_path=os.getenv('BROWSER_PATH'))
    page = browser.new_page()
    page.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda route: route.abort())
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    panel = page.locator('.home-console')
    panel.hover()
    input_box = page.locator('#terminal-command')
    power = panel.locator('.terminal-power-curtain')
    log = panel.locator('.terminal-boot-log')

    def command(text):
        input_box.fill(text)
        input_box.press('Enter')

    def finish_boot():
        expect(log).to_have_attribute('data-stage', 'grub', timeout=8500)
        expect(log).to_contain_text('virtio_net', timeout=8500)
        expect(log).to_contain_text('fsck.ext4: /dev/vda1: clean')
        expect(log).to_contain_text('Started Getty on tty1.', timeout=8500)
        expect(log).to_contain_text('debian login: linfon18')
        expect(power).to_be_hidden(timeout=4000)
        expect(input_box).to_be_editable()

    command('gdb')
    command('exit')
    expect(panel).to_contain_text('Leaving gdb.')
    expect(power).to_be_hidden()
    command('touch temp-session')
    command('export SESSION_TEST=yes')
    command('cd /tmp')
    command('exit 0 1')
    expect(panel).to_contain_text('too many arguments')
    command('exit')
    expect(power).to_have_css('background-color', 'rgb(0, 0, 0)')
    panel_box, black_box = panel.bounding_box(), power.bounding_box()
    assert black_box['height'] >= panel_box['height'] - 3
    expect(input_box).not_to_be_editable()
    page.wait_for_function("""() => {
      const q = document.querySelector('.terminal-power-question');
      return Number(getComputedStyle(q).opacity) > .85;
    }""")
    page.wait_for_function("""() => {
      const q = document.querySelector('.terminal-power-question');
      return Number(getComputedStyle(q).opacity) < .15;
    }""")
    expect(power).to_have_attribute('data-power', 'question')
    expect(log).to_contain_text('PowerUp', timeout=6500)
    finish_boot()
    input_box.press('ArrowUp')
    expect(input_box).to_have_value('')
    command('pwd')
    expect(panel).to_contain_text('/home/linfon18/scratch/netprobe')
    command('ls temp-session')
    expect(panel).to_contain_text('No such file or directory')
    command('echo ${SESSION_TEST}clean')
    expect(panel.locator('.terminal-row').last).to_have_text('clean')

    command('sudo shutdown -h now')
    button = panel.get_by_role('button', name='PowerUp')
    expect(button).to_be_visible()
    expect(power).to_have_attribute('data-power', 'off')
    button.click()
    finish_boot()
    command('sudo reboot')
    expect(power).to_have_attribute('data-power', 'question')
    expect(log).to_contain_text('PowerUp', timeout=6500)
    finish_boot()
    command('echo ready')
    expect(panel.locator('.terminal-row').last).to_have_text('ready')
    assert not errors, errors
    print('GDB exit, Bash exit, power-off, PowerUp and reboot passed')
    browser.close()
    server.shutdown()
