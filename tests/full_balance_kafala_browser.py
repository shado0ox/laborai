"""Full-balance Other receipt must cover previously assessed kafala, in the disposable sandbox."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.environ.get('LABORAI_CHROMIUM_EXECUTABLE'),args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
    page=browser.new_page(viewport={'width':1440,'height':1000}); errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto('http://127.0.0.1:3151')
    page.get_by_label('البريد الإلكتروني',exact=True).fill('admin@laborai.test')
    page.get_by_label('كلمة المرور',exact=True).fill('Sandbox-only-2026')
    page.get_by_role('button',name='تسجيل الدخول',exact=True).last.click()
    page.get_by_text('متابعة العمالة والإقامات والتحصيل',exact=True).wait_for()
    page.wait_for_load_state('networkidle')
    headers={'Authorization':'Bearer '+page.evaluate("sessionStorage.getItem('authToken')")}
    base='http://127.0.0.1:3151'
    worker=next(row for row in page.request.get(base+'/api/employees',headers=headers).json() if row['iqamaNo']=='2000000002')
    worker.update(iqamaBalance=7100,kafalaCount=6,otherDebt=0)
    assert page.request.post(base+'/api/employees',headers=headers,data=worker).ok
    for id,amount,description,notes in [('iq',7100,'قيد مديونية: إقامة',''),('kf',1500,'قيد مديونية: كفالة','كفالة من ذي القعده 47 الي ربيع ثاني 48')]:
        assert page.request.post(base+'/api/payments',headers=headers,data={'id':id,'iqamaNo':worker['iqamaNo'],'name':worker['name'],'branch':worker['branch'],'amount':amount,'type':description,'notes':notes,'date':'2026-10-04','hijriMonth':'ذو القعدة','hijriYear':'1448'}).ok
    def statement():
        page.get_by_role('row').filter(has_text=worker['name']).get_by_role('button',name='كشف الحساب',exact=True).click()
    page.reload(); page.wait_for_load_state('networkidle')
    page.get_by_role('button',name='ملفات العمالة').click(); statement()
    expect(page.get_by_text('لم يُسجل سداد',exact=True)).to_be_visible()
    page.get_by_role('button',name='الرجوع لجدول العمالة الرئيسي',exact=True).click()
    page.get_by_role('button',name='إجراءات '+worker['name'],exact=True).click()
    page.get_by_role('menuitem',name='تحصيل دفعة',exact=True).click()
    page.get_by_role('button',name='أخرى',exact=True).click()
    page.get_by_role('button',name='سداد كامل المستحق',exact=True).click()
    expect(page.get_by_label('مبلغ التحصيل الآخر')).to_have_value('8600')
    with page.expect_response(lambda r:'/api/payments?' in r.url and r.request.method=='POST') as saved:
        page.get_by_role('button',name='تسجيل التحصيل',exact=True).click()
    assert saved.value.status==200
    expect(page.get_by_role('button',name='تسجيل التحصيل',exact=True)).to_have_count(0)
    statement()
    assert 'شهر كفالة متبق' not in page.locator('main').inner_text()
    expect(page.get_by_text('لا توجد مستحقات مسجلة غير مسددة على العامل.',exact=True)).to_be_visible()
    label=page.get_by_text('آخر شهر سُجل له تحصيل كفالة',exact=True)
    expect(label.locator('..')).to_contain_text('ربيع الآخر 1448')
    page.reload(); page.wait_for_load_state('networkidle')
    page.get_by_role('button',name='ملفات العمالة').click(); statement()
    expect(page.get_by_text('آخر شهر سُجل له تحصيل كفالة',exact=True).locator('..')).to_contain_text('ربيع الآخر 1448')
    Path('test-results').mkdir(exist_ok=True)
    page.screenshot(path='test-results/full-balance-kafala.png',full_page=True)
    records=page.request.get(base+'/api/payments',headers=headers).json()
    receipt=next(row for row in records if row['type']=='سداد كامل المستحق')
    assert receipt['category']=='other' and receipt['transactionKind']=='receipt' and not receipt.get('kafalaPeriod')
    assert not errors,errors
    browser.close()
    print('PASS: Other full balance receipt updates legacy kafala covered month immediately and after reload')
