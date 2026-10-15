"""Run only on disposable sandbox: eligibility, early exception, return and assessed exemption."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('LABORAI_CHROMIUM_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:3151')
    page.get_by_label('البريد الإلكتروني',exact=True).fill('admin@laborai.test');page.get_by_label('كلمة المرور',exact=True).fill('Sandbox-only-2026')
    page.get_by_role('button',name='تسجيل الدخول',exact=True).last.click();page.get_by_text('متابعة العمالة والإقامات والتحصيل',exact=True).wait_for();page.wait_for_load_state('networkidle')
    page.get_by_role('button',name='الإجازات والخروج والعودة',exact=True).click()
    page.get_by_role('button',name='متابعة إجازة عامل تجريبي 1',exact=True).click()
    page.get_by_label('تاريخ الدخول الأساسي للسعودية').fill('2020-01-01')
    with page.expect_response(lambda r:'/saudi-entry' in r.url and r.request.method=='POST') as saved:page.get_by_role('button',name='حفظ تاريخ الدخول',exact=True).click()
    assert saved.value.status==200;page.wait_for_load_state('networkidle')
    page.get_by_role('button',name='تسجيل إجازة',exact=True).click()
    page.get_by_label('تاريخ السفر',exact=True).fill('2022-01-01');page.get_by_label('تاريخ العودة المتوقع',exact=True).fill('2022-03-01')
    page.get_by_label('سياسة كفالة الإجازة').select_option('eligible')
    page.get_by_role('checkbox').nth(1).check()
    with page.expect_response(lambda r:r.url.endswith('/api/worker-leaves') and r.request.method=='POST') as saved:page.get_by_role('button',name='حفظ واعتماد الإجازة',exact=True).click()
    assert saved.value.status==201;page.wait_for_load_state('networkidle')
    page.get_by_role('button',name='تسجيل العودة',exact=True).click();page.get_by_label('تاريخ تسجيل العودة الفعلية').fill('2022-03-01')
    with page.expect_response(lambda r:r.url.endswith('/return') and r.request.method=='POST') as saved:page.get_by_role('button',name='تأكيد العودة وبداية دورة جديدة',exact=True).click()
    assert saved.value.status==200;page.wait_for_load_state('networkidle')
    expect(page.locator('main')).to_contain_text('2024-03-01')
    page.get_by_role('button',name='تسجيل إجازة',exact=True).click()
    page.get_by_label('تاريخ السفر',exact=True).fill('2023-12-01');page.get_by_label('تاريخ العودة المتوقع',exact=True).fill('2024-02-01')
    page.get_by_label('سياسة كفالة الإجازة').select_option('exception');page.get_by_label('سبب إعفاء الإجازة الاستثنائي').fill('موافقة المدير قبل السنتين بثلاثة شهور')
    page.get_by_role('checkbox').first.check()
    with page.expect_response(lambda r:r.url.endswith('/api/worker-leaves') and r.request.method=='POST') as saved:page.get_by_role('button',name='حفظ واعتماد الإجازة',exact=True).click()
    assert saved.value.status==201;entry=saved.value.json()['leave'];page.wait_for_load_state('networkidle')
    assert len(entry['exemptMonths'])==1
    page.evaluate('window.scrollTo(0,0)');page.wait_for_function('window.scrollY===0')
    Path('test-results').mkdir(exist_ok=True);page.screenshot(path='test-results/worker-leave-desktop.png',full_page=True)
    page.get_by_role('button',name='ملفات العمالة').click();page.get_by_role('button',name='إجراءات عامل تجريبي 1',exact=True).click();page.get_by_role('menuitem',name='إثبات مديونية',exact=True).click()
    headers={'Authorization':'Bearer '+page.evaluate("sessionStorage.getItem('authToken')")}
    # Derive trip month endpoints using the same public calendar interpretation, via the actual form's selected month snapshot.
    fy,fm=map(int,entry['exemptMonths'][0].split('-'))
    end_index=fy*12+fm-1+2;ty,tm=end_index//12,end_index%12+1
    page.get_by_label('سنة البداية الهجرية').fill(str(fy));page.get_by_label('من شهر هجري').select_option(str(fm))
    page.get_by_label('سنة النهاية الهجرية').fill(str(ty));page.get_by_label('إلى شهر هجري').select_option(str(tm))
    expect(page.locator('#kafala-debt-amount')).to_have_value('500')
    expect(page.get_by_text('إعفاء إجازة معتمد: 1 شهر',exact=False)).to_be_visible()
    with page.expect_response(lambda r:'/api/payments?' in r.url and r.request.method=='POST') as saved:page.get_by_role('button',name='إثبات المديونية',exact=True).click()
    assert saved.value.status==200 and saved.value.json()['payment']['kafalaExemptMonths']==entry['exemptMonths']
    page.get_by_role('button',name='الإجازات والخروج والعودة',exact=True).click();page.get_by_role('button',name='متابعة إجازة عامل تجريبي 1',exact=True).click()
    page.set_viewport_size({'width':390,'height':844});page.wait_for_function("document.querySelector('#app-navigation').getBoundingClientRect().x >= innerWidth - 1")
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),'Leave UI overflows mobile'
    page.screenshot(path='test-results/worker-leave-mobile.png',full_page=True)
    assert not errors,errors;browser.close()
    print('PASS: entry date, two-year eligibility, actual return reset, three-month early exception, manual month selection, net kafala debt and mobile layout')
