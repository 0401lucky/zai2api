from zai2api.admin_page import render_admin_page


def test_admin_page_renders_api_route_copy_without_breaking_script_templates() -> None:
    html = render_admin_page()

    assert "Control whether <code>/v1/*</code> requires a password" in html
