"""Only run on the disposable sandbox: verifies destructive reset guards."""
import os
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('LABORAI_CHROMIUM_EXECUTABLE'), args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:3151')
    page.wait_for_load_state('networkidle')
    page.get_by_label('البريد الإلكتروني',exact=True).fill('admin@laborai.test')
    page.get_by_label('كلمة المرور',exact=True).fill('Sandbox-only-2026')
    page.get_by_role('button',name='تسجيل الدخول',exact=True).last.click()
    page.get_by_text('متابعة العمالة والإقامات والتحصيل',exact=True).wait_for()
    page.wait_for_load_state('networkidle')
    expect(page.locator('#app-navigation').get_by_role('button',name='مسح بيانات مساحة العمل')).to_have_count(0)
    page.get_by_role('button',name='إعدادات الشركة',exact=True).click()
    page.get_by_role('button',name='مسح بيانات مساحة العمل',exact=True).click()
    dialog=page.get_by_role('dialog')
    save=dialog.get_by_role('button',name='مسح البيانات نهائيًا',exact=True)
    expect(save).to_be_disabled()
    dialog.get_by_label('كلمة المرور لتأكيد المسح').fill('wrong-password')
    dialog.get_by_label('عبارة تأكيد مسح مساحة العمل').fill('مسح بيانات مساحة العمل')
    expect(save).to_be_disabled()
    dialog.get_by_role('checkbox').check()
    with page.expect_response(lambda r:'/api/system/wipe' in r.url and r.request.method=='POST') as response:save.click()
    assert response.value.status==403
    expect(dialog.get_by_role('alert')).to_contain_text('غير صحيحة')
    token=page.evaluate("sessionStorage.getItem('authToken')")
    headers={'Authorization':'Bearer '+token}
    assert len(page.request.get('http://127.0.0.1:3151/api/employees',headers=headers).json())==4
    dialog.get_by_label('كلمة المرور لتأكيد المسح').fill('Sandbox-only-2026')
    with page.expect_response(lambda r:'/api/system/wipe' in r.url and r.request.method=='POST') as response:save.click()
    assert response.value.status==200
    expect(dialog).to_have_count(0)
    assert page.request.get('http://127.0.0.1:3151/api/employees',headers=headers).json()==[]
    assert page.request.get('http://127.0.0.1:3151/api/payments',headers=headers).json()==[]
    assert page.request.get('http://127.0.0.1:3151/api/branches',headers=headers).json()==[]
    assert page.request.get('http://127.0.0.1:3151/api/company-settings',headers=headers).json()['name']=='منشأة التجربة لإدارة العمالة'
    assert len(page.request.get('http://127.0.0.1:3151/api/logs',headers=headers).json())==1
    assert not errors,errors
    browser.close()
    print('PASS: reset only in settings, required phrase/password/backup, wrong password preserves data, verified reset preserves company settings and audit')
