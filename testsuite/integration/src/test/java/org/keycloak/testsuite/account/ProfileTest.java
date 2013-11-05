package org.keycloak.testsuite.account;

import org.apache.commons.io.IOUtils;
import org.apache.http.HttpHeaders;
import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.DefaultHttpClient;
import org.json.JSONObject;
import org.junit.ClassRule;
import org.junit.Rule;
import org.junit.Test;
import org.keycloak.models.ApplicationModel;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.services.managers.RealmManager;
import org.keycloak.testsuite.Constants;
import org.keycloak.testsuite.OAuthClient;
import org.keycloak.testsuite.pages.AccountUpdateProfilePage;
import org.keycloak.testsuite.pages.LoginPage;
import org.keycloak.testsuite.pages.OAuthGrantPage;
import org.keycloak.testsuite.rule.KeycloakRule;
import org.keycloak.testsuite.rule.WebResource;
import org.keycloak.testsuite.rule.WebRule;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;

import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriBuilder;
import java.io.IOException;
import java.net.URI;
import java.util.Collections;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/**
 * @author <a href="mailto:sthorger@redhat.com">Stian Thorgersen</a>
 */
public class ProfileTest {

    @ClassRule
    public static KeycloakRule keycloakRule = new KeycloakRule(new KeycloakRule.KeycloakSetup() {
        @Override
        public void config(RealmManager manager, RealmModel adminstrationRealm, RealmModel appRealm) {
            UserModel user = appRealm.getUser("test-user@localhost");
            user.setFirstName("First");
            user.setLastName("Last");
            user.setAttribute("key1", "value1");
            user.setAttribute("key2", "value2");

            ApplicationModel accountApp = appRealm.getApplicationNameMap().get(org.keycloak.models.Constants.ACCOUNT_APPLICATION);

            ApplicationModel app = appRealm.getApplicationNameMap().get("test-app");
            accountApp.addScopeMapping(app.getApplicationUser(), org.keycloak.models.Constants.ACCOUNT_PROFILE_ROLE);

            app.getApplicationUser().addWebOrigin("http://localtest.me:8081");

            UserModel thirdParty = appRealm.getUser("third-party");
            accountApp.addScopeMapping(thirdParty, org.keycloak.models.Constants.ACCOUNT_PROFILE_ROLE);
        }
    });

    @Rule
    public WebRule webRule = new WebRule(this);

    @WebResource
    protected WebDriver driver;

    @WebResource
    protected OAuthClient oauth;

    @WebResource
    protected AccountUpdateProfilePage profilePage;

    @WebResource
    protected LoginPage loginPage;

    @WebResource
    protected OAuthGrantPage grantPage;

    private List<String> defaultRoles;

    @Test
    public void getProfile() throws Exception {
        oauth.doLogin("test-user@localhost", "password");

        String code = oauth.getCurrentQuery().get("code");
        String token = oauth.doAccessTokenRequest(code, "password").getAccessToken();

        HttpResponse response = doGetProfile(token, null);
        assertEquals(200, response.getStatusLine().getStatusCode());
        JSONObject profile = new JSONObject(IOUtils.toString(response.getEntity().getContent()));

        assertEquals("test-user@localhost", profile.getString("username"));
        assertEquals("test-user@localhost", profile.getString("email"));
        assertEquals("First", profile.getString("firstName"));
        assertEquals("Last", profile.getString("lastName"));

        JSONObject attributes = profile.getJSONObject("attributes");
        assertEquals(2, attributes.length());
        assertEquals("value1", attributes.getString("key1"));
        assertEquals("value2", attributes.getString("key2"));
    }

    @Test
    public void getProfileCors() throws Exception {
        oauth.doLogin("test-user@localhost", "password");

        String code = oauth.getCurrentQuery().get("code");
        String token = oauth.doAccessTokenRequest(code, "password").getAccessToken();

        driver.navigate().to("http://localtest.me:8081/app");

        String[] response = doGetProfileJs(token);
        assertEquals("200", response[0]);
    }

    @Test
    public void getProfileCorsInvalidOrigin() throws Exception {
        oauth.doLogin("test-user@localhost", "password");

        String code = oauth.getCurrentQuery().get("code");
        String token = oauth.doAccessTokenRequest(code, "password").getAccessToken();

        driver.navigate().to("http://invalid.localtest.me:8081");

        try {
            doGetProfileJs(token);
            fail("Expected failure");
        } catch (Throwable t) {
        }
    }

    @Test
    public void getProfileCookieAuth() throws Exception {
        profilePage.open();
        loginPage.login("test-user@localhost", "password");

        String[] response = doGetProfileJs(null);
        assertEquals("200", response[0]);

        JSONObject profile = new JSONObject(response[1]);
        assertEquals("test-user@localhost", profile.getString("username"));
    }

    @Test
    public void getProfileNoAuth() throws Exception {
        HttpResponse response = doGetProfile(null, null);
        assertEquals(403, response.getStatusLine().getStatusCode());
    }

    @Test
    public void getProfileNoAccess() throws Exception {
        try {
            keycloakRule.configure(new KeycloakRule.KeycloakSetup() {
                @Override
                public void config(RealmManager manager, RealmModel adminstrationRealm, RealmModel appRealm) {
                    ApplicationModel app = appRealm.getApplicationNameMap().get(org.keycloak.models.Constants.ACCOUNT_APPLICATION);
                    defaultRoles = app.getDefaultRoles();
                    app.updateDefaultRoles(new String[0]);
                }
            });

            oauth.doLogin("test-user@localhost", "password");

            String code = oauth.getCurrentQuery().get("code");
            String token = oauth.doAccessTokenRequest(code, "password").getAccessToken();

            HttpResponse response = doGetProfile(token, null);
            assertEquals(403, response.getStatusLine().getStatusCode());
        } finally {
            keycloakRule.configure(new KeycloakRule.KeycloakSetup() {
                @Override
                public void config(RealmManager manager, RealmModel adminstrationRealm, RealmModel appRealm) {
                    appRealm.getApplicationNameMap().get(org.keycloak.models.Constants.ACCOUNT_APPLICATION).updateDefaultRoles((String[]) defaultRoles.toArray());
                }
            });
        }
    }

    @Test
    public void getProfileOAuthClient() throws Exception {
        oauth.addScope(org.keycloak.models.Constants.ACCOUNT_APPLICATION, org.keycloak.models.Constants.ACCOUNT_PROFILE_ROLE);
        oauth.clientId("third-party");
        oauth.doLoginGrant("test-user@localhost", "password");

        grantPage.accept();

        String token = oauth.doAccessTokenRequest(oauth.getCurrentQuery().get("code"), "password").getAccessToken();
        HttpResponse response = doGetProfile(token, null);

        assertEquals(200, response.getStatusLine().getStatusCode());
        JSONObject profile = new JSONObject(IOUtils.toString(response.getEntity().getContent()));

        assertEquals("test-user@localhost", profile.getString("username"));
    }

    @Test
    public void getProfileOAuthClientNoScope() throws Exception {
        oauth.addScope(org.keycloak.models.Constants.ACCOUNT_APPLICATION);
        oauth.clientId("third-party");
        oauth.doLoginGrant("test-user@localhost", "password");

        String token = oauth.doAccessTokenRequest(oauth.getCurrentQuery().get("code"), "password").getAccessToken();
        HttpResponse response = doGetProfile(token, null);

        assertEquals(403, response.getStatusLine().getStatusCode());
    }

    private URI getAccountURI() {
        return UriBuilder.fromUri(Constants.AUTH_SERVER_ROOT + "/rest/realms/" + oauth.getRealm() + "/account").build();
    }

    private HttpResponse doGetProfile(String token, String origin) throws IOException {
        HttpClient client = new DefaultHttpClient();
        HttpGet get = new HttpGet(UriBuilder.fromUri(getAccountURI()).build());
        if (token != null) {
            get.setHeader(HttpHeaders.AUTHORIZATION, "bearer " + token);
        }
        if (origin != null) {
            get.setHeader("Origin", origin);
        }
        get.setHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON);
        return client.execute(get);
    }

    private String[] doGetProfileJs(String token) {
        StringBuilder sb = new StringBuilder();
        sb.append("var req = new XMLHttpRequest();\n");
        sb.append("req.open('GET', '" + getAccountURI().toString() + "', false);\n");
        if (token != null) {
            sb.append("req.setRequestHeader('Authorization', 'Bearer " + token + "');\n");
        }
        sb.append("req.setRequestHeader('Accept', 'application/json');\n");
        sb.append("req.send(null);\n");
        sb.append("return req.status + '///' + req.responseText;\n");

        JavascriptExecutor js = (JavascriptExecutor) driver;
        String response = (String) js.executeScript(sb.toString());
        return response.split("///");
    }
}