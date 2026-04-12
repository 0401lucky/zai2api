from zai2api.admin_page import render_admin_page


def test_admin_page_renders_api_route_copy_without_breaking_script_templates() -> None:
    html = render_admin_page()

    assert "控制 <code>/v1/*</code> 是否需要密码" in html


def test_admin_page_uses_light_fluent_styling_and_scrollable_content() -> None:
    html = render_admin_page()

    assert "color-scheme: light;" in html
    assert "display: flex;" in html
    assert "overflow-wrap: anywhere;" in html
