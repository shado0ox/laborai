"""Run against the disposable `npm run sandbox`, never against production."""
import argparse
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:3151')
parser.add_argument('--output', default='test-results/browser')
args = parser.parse_args()
output = Path(args.output)
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    options = {'headless': True}
    if os.getenv('LABORAI_CHROMIUM_EXECUTABLE'):
        options['executable_path'] = os.environ['LABORAI_CHROMIUM_EXECUTABLE']
        options['args'] = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    browser = p.chromium.launch(**options)
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.base_url)
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(output / 'login-desktop.png'), full_page=True)
    page.get_by_label('البريد الإلكتروني', exact=True).fill('admin@laborai.test')
    page.get_by_label('كلمة المرور', exact=True).fill('Sandbox-only-2026')
    page.get_by_role('button', name='تسجيل الدخول', exact=True).last.click()
    page.get_by_text('متابعة العمالة والإقامات والتحصيل', exact=True).wait_for()
    page.wait_for_load_state('networkidle')
    page.screenshot(path=str(output / 'dashboard-desktop.png'), full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), 'Dashboard overflows mobile viewport'
    page.screenshot(path=str(output / 'dashboard-mobile.png'), full_page=True)
    page.get_by_role('button', name='فتح قائمة التنقل', exact=True).click()
    page.get_by_role('button', name='ملفات العمالة').click()
    page.wait_for_function("document.querySelector('#app-navigation').getBoundingClientRect().x >= innerWidth - 1")
    assert page.get_by_text('عامل تجريبي 1', exact=True).is_visible()
    page.screenshot(path=str(output / 'employees-mobile.png'), full_page=True)
    page.get_by_role('button', name='فتح قائمة التنقل', exact=True).click()
    page.get_by_role('button', name='إعدادات الشركة', exact=True).click()
    page.wait_for_function("document.querySelector('#app-navigation').getBoundingClientRect().x >= innerWidth - 1")
    page.get_by_label('اسم المستخدم الجديد', exact=True).fill('عضو التجربة')
    page.get_by_label('بريد المستخدم الجديد', exact=True).fill('member@laborai.test')
    page.get_by_label('كلمة مرور المستخدم الجديد', exact=True).fill('Member-test-2026')
    page.get_by_label('صلاحية المستخدم الجديد', exact=True).select_option('viewer')
    page.on('dialog', lambda dialog: dialog.accept())
    with page.expect_response(lambda response: response.url.endswith('/api/users') and response.request.method == 'POST') as created:
        page.get_by_role('button', name='تثبيت وإرسال دعوة التسجيل', exact=True).click()
    assert created.value.status == 201
    page.get_by_text('عضو التجربة', exact=True).wait_for()
    page.screenshot(path=str(output / 'settings-mobile.png'), full_page=True)
    page.get_by_role('button', name='فتح قائمة التنقل', exact=True).click()
    page.get_by_role('button', name='تسجيل الخروج', exact=True).click()
    page.get_by_role('button', name='منشأة جديدة', exact=True).click()
    requests = []
    page.on('request', lambda request: requests.append(request) if request.url.endswith('/api/users') and request.method == 'POST' else None)
    page.get_by_label('اسم المدير أو المنشأة', exact=True).fill('منشأة جديدة للتجربة')
    page.get_by_label('البريد الإلكتروني', exact=True).fill('applicant-ui@laborai.test')
    page.get_by_label('كلمة المرور', exact=True).fill('Applicant-test-2026')
    page.get_by_role('button', name='إرسال طلب التسجيل', exact=True).click()
    page.get_by_text('تم إرسال طلب التسجيل', exact=True).wait_for()
    page.wait_for_load_state('networkidle')
    assert len(requests) == 1, 'Registration must submit exactly one request'
    assert not errors, errors
    browser.close()
    print('PASS: login, desktop/mobile layout, navigation, member creation and single registration request; no JavaScript errors')
