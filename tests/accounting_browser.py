"""Accounting flows against the disposable sandbox, using real form submissions."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
out = Path('test-results/accounting'); out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('LABORAI_CHROMIUM_EXECUTABLE'), args=['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'])
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]; page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:3151')
    page.get_by_label('البريد الإلكتروني', exact=True).fill('admin@laborai.test')
    page.get_by_label('كلمة المرور', exact=True).fill('Sandbox-only-2026')
    page.get_by_role('button', name='تسجيل الدخول', exact=True).last.click()
    page.get_by_text('متابعة العمالة والإقامات والتحصيل', exact=True).wait_for()
    def nav(name):
        page.get_by_role('button',name=name).click(); page.wait_for_load_state('networkidle')
    def action(name):
        page.get_by_role('button',name='إجراءات عامل تجريبي 1',exact=True).click()
        page.get_by_role('menuitem',name=name,exact=True).click()
    nav('ملفات العمالة'); action('إثبات مديونية')
    page.get_by_label('سنة البداية الهجرية',exact=True).fill('1447')
    page.get_by_label('من شهر هجري',exact=True).select_option('1')
    page.get_by_label('سنة النهاية الهجرية',exact=True).fill('1448')
    page.get_by_label('إلى شهر هجري',exact=True).select_option('6')
    expect(page.locator('#kafala-debt-amount')).to_have_value('4500')
    page.screenshot(path=str(out/'debt-multi-year-desktop.png'),full_page=True)
    with page.expect_response(lambda r: '/api/payments?' in r.url and r.request.method=='POST') as saved:
        page.get_by_role('button',name='إثبات المديونية',exact=True).click()
    assert saved.value.status==200
    expect(page.get_by_role('button',name='إثبات المديونية',exact=True)).to_have_count(0)
    action('تحصيل دفعة')
    page.get_by_label('سنة البداية الهجرية',exact=True).fill('1448')
    page.get_by_label('من شهر هجري',exact=True).select_option('6')
    page.get_by_label('سنة النهاية الهجرية',exact=True).fill('1448')
    page.get_by_label('إلى شهر هجري',exact=True).select_option('6')
    with page.expect_response(lambda r: '/api/payments?' in r.url and r.request.method=='POST') as saved:
        page.get_by_role('button',name='تسجيل التحصيل',exact=True).click()
    assert saved.value.status==200
    row=page.get_by_role('row').filter(has_text='عامل تجريبي 1')
    row.get_by_role('button',name='كشف الحساب',exact=True).click()
    expect(page.get_by_text('آخر شهر سُجل له تحصيل كفالة',exact=True)).to_be_visible()
    assert 'جمادى الآخرة 1448' in page.locator('main').inner_text()
    expect(page.get_by_text('آخر شهر كفالة محسوب',exact=True)).to_be_visible()
    page.screenshot(path=str(out/'worker-statement-desktop.png'),full_page=True)
    page.reload(); page.wait_for_load_state('networkidle'); nav('ملفات العمالة')
    page.get_by_role('row').filter(has_text='عامل تجريبي 1').get_by_role('button',name='كشف الحساب',exact=True).click()
    assert 'جمادى الآخرة 1448' in page.locator('main').inner_text()
    token=page.evaluate("sessionStorage.getItem('authToken')")
    response=page.request.post('http://127.0.0.1:3151/api/branches',headers={'Authorization':'Bearer '+token},data=['الدمام','الخبر','الرياض','جدة'])
    assert response.ok
    page.reload(); page.wait_for_load_state('networkidle'); nav('حسابات المحلات والفروع')
    expect(page.get_by_label('فرع كشف المحل')).to_have_count(1)
    assert page.get_by_label('فرع كشف المحل').locator('option').count()==4
    page.get_by_label('فرع كشف المحل').select_option(label='الدمام')
    def shop(kind,amount,description,paid=False):
        page.get_by_role('button',name='إضافة حركة للمحل',exact=True).click()
        page.get_by_label('نوع حركة المحل').select_option(kind)
        page.get_by_label('مبلغ حركة المحل').fill(str(amount))
        page.get_by_label('بيان حركة المحل').fill(description)
        if paid: page.get_by_label('دفعت الشركة المصروف فعليًا من الصندوق أو البنك').check()
        with page.expect_response(lambda r: r.url.endswith('/api/shop-entries') and r.request.method=='POST') as response:
            page.get_by_role('button',name='حفظ حركة المحل',exact=True).click()
        assert response.value.status==201
    shop('charge',1000,'زكاة محملة غير مدفوعة')
    shop('charge',500,'زكاة دفعتها الشركة',True)
    shop('receipt',200,'تحصيل مسؤول الدمام')
    expect(page.get_by_role('row').filter(has_text='تحصيل مسؤول الدمام').get_by_text('1,300.00',exact=True)).to_be_visible()
    page.screenshot(path=str(out/'shops-desktop.png'),full_page=True)
    page.get_by_label('فرع كشف المحل').select_option(label='الخبر')
    assert 'زكاة محملة غير مدفوعة' not in page.locator('main').inner_text()
    nav('كشف الوارد والصادر العام')
    assert 'زكاة محملة غير مدفوعة' not in page.locator('main').inner_text()
    assert page.get_by_role('row').filter(has_text='زكاة دفعتها الشركة').count()==1
    assert page.get_by_role('row').filter(has_text='تحصيل مسؤول الدمام').count()==1
    page.screenshot(path=str(out/'cashbook-desktop.png'),full_page=True)
    page.get_by_role('button',name='القيود المقابلة',exact=True).click()
    assert page.get_by_role('row').filter(has_text='زكاة دفعتها الشركة').count()==2
    page.screenshot(path=str(out/'journal-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_function("document.querySelector('#app-navigation').getBoundingClientRect().x >= innerWidth - 1")
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), 'Accounting view overflows mobile'
    page.screenshot(path=str(out/'accounting-mobile.png'),full_page=True)
    assert not errors,errors
    browser.close()
    print('PASS: multi-year debt, persisted receipt coverage, four independent shops, paid/unpaid cash impact, balanced journal and mobile layout')
