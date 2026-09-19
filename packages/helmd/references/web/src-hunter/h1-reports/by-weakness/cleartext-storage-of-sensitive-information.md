# Cleartext Storage of Sensitive Information

_22 reports — High/Critical, disclosed_

### [Critical PII Data Exposure in ORDER_ERROR_LOG](https://hackerone.com/reports/3242830)

- **Report ID:** `3242830`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @xenion_
- **Bounty:** - usd
- **Disclosed:** 2026-01-12T19:44:34.035Z
- **CVE(s):** -

**Vulnerability Information:**

A critical security vulnerability has been identified in the application's error logging system where the ORDER_ERROR_LOG file contains complete database insertion statements that expose Personally Identifiable Information (PII) of customers in plain text format.

#### Root Cause

The application's error handling mechanism is logging full SQL INSERT statements when database operations fail. These statements contain complete customer records including sensitive personal information that should never be stored in log files.

What Data is ExposedThe logs contain complete customer records including:
Full names
Email addresses
Phone numbers
Home addresses
Customer IDs
Transaction amounts
....

simple of data 
```
INSERT INTO dli.dli_customer_data VALUES (
                dli_customer_data_sequence.NEXTVAL,
                SYSDATE,
                ████████,
                ███,
                ██████████,
                ████,
                ██████,
                ██████,
                █████████,
                █████████,
                ███████,
                █████,
                ███,
                █████,
                ███,
                ████████,
                ████,
                ██████████,
                'Surface',
                '14.00',
                '15.4',
                '17.5')

```
███████
████

## Impact

Unintended Data Persistence: Customer PII persists in log files beyond intended retention periods
Expanded Attack Surface: Log files become high-value targets containing concentrated PII
Compliance Violations: Direct violation of data minimization principles required by privacy regulations
Audit Trail Contamination: Security logs contain sensitive data that complicates forensic analysis

## System Host(s)
dlielc.edu

## Affected Product(s) and Version(s)

## CVE Numbers

## Steps to Reproduce
1. Access the ORDER_ERROR_LOG file   ███████
2. Review the contents for database INSERT statements.  `INSERT INTO dli.dli_customer_data VALUES (`
3. Observe exposed customer data
```
  INSERT INTO dli.dli_customer_data VALUES (
                dli_customer_data_sequence.NEXTVAL,
                SYSDATE,
                █████████,
                ██████,
                ███████,
                'FPO',
                'AP',
                ██████████,
                ████████,
                ███,
                ██████████,
                'FPO',
                'AP',
                ███████,
                ████████,
                █████,
                ██████,
                ██████,
                'Air',
                '480.00',
                ████████,
                '600')

```

## Suggested Mitigation/Remediation Actions
Implement data sanitization in error logging to prevent PII exposure.

---

### [[Critical Data Breach] Exposure of PII Data Leak via API Response](https://hackerone.com/reports/3078508)

- **Report ID:** `3078508`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @rocky1696
- **Bounty:** - usd
- **Disclosed:** 2026-01-12T19:09:17.625Z
- **CVE(s):** -

**Summary (team):**

A critical information disclosure vulnerability was discovered, exposing sensitive user data via an API response. The leaked data includes full name, email, phone number, account details, user roles, and authentication-related identifiers. This poses a significant privacy risk and can lead to identity theft, phishing attacks, and unauthorized access.

---

### [Leaked reused password for a few Khan Academy users](https://hackerone.com/reports/3099978)

- **Report ID:** `3099978`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Khan Academy
- **Reporter:** @a0xtrojan
- **Bounty:** - usd
- **Disclosed:** 2025-07-12T10:31:05.440Z
- **CVE(s):** -

**Vulnerability Information:**

I found A lot of credentials for your domain
on the Telegram bot: ███
While the exact sources of the leaked data are unknown, the volume of exposed information is substantial. This report is submitted for your review to assess and mitigate the exposure of user credentials, including emails and passwords.
Steps To Reproduce:
1-access this chatbot ===> ██████
2-start the chatbot
3 - add  www.khanacademy.org/login
4-u will get the passwords and emails just download them ███████
try
(username or email : password)
 ██████ : ███
████ : ██████
███ : ████████

## Impact

Impact
Exposure of user emails and passwords, leading to credential compromise.
Increased risk of account takeover (ATO) if users reuse passwords across platforms.
Potential for phishing and social engineering attacks targeting affected users.
Reputational damage due to leaked user data.
Regulatory and compliance risks, depending on applicable data protection laws.

---

### [Unauthorized Account Access via Leaked Credentials in URL Format (Account Takeover )](https://hackerone.com/reports/3080597)

- **Report ID:** `3080597`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Khan Academy
- **Reporter:** @firec4t
- **Bounty:** - usd
- **Disclosed:** 2025-05-07T23:08:32.838Z
- **CVE(s):** -

**Vulnerability Information:**

I discovered a critical vulnerability that allows attackers to access user accounts on khanAcademy.com using credentials publicly available on VirusTotal., an attacker can directly authenticate into a user’s account without any secondary verification or alert to the user.
i have reported a similar issue , here's the report ( 2981324 ) 

this time the email and password of the victim is archived in clear text ( https://en.khanacademy.org/login,██████,,█████████,,,█████████,██████████,Personal )

by entering the mail ( ██████████ ) and password ( ███████ ) in the login , the attacker can easily perform account takeover

Please Enforce 2FA: Make two-factor authentication mandatory, especially for accounts with detected exposure.

## Impact

Full account takeover: Unauthorized access to user accounts with no user awareness.

Exposure of personal data: Private information such as learning progress, messages, and linked accounts may be compromised.

Potential financial or reputational damage: If linked to other services, this access may lead to wider exploitation.

---

### [███ leaking PII of tour visitors (names, email addresses, phone numbers) via misconfigured record permissions](https://hackerone.com/reports/2294930)

- **Report ID:** `2294930`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @oxylis
- **Bounty:** - usd
- **Disclosed:** 2024-03-22T17:55:12.446Z
- **CVE(s):** -

**Vulnerability Information:**

Dear DoD team,

The ████████ is leaking a large amount of sensitive data, including **full names, email addresses and phone numbers**. These are accessible by any registered user, as there is no additional verification. 

Any registered user of the portal is able to gain access to records other users (most likely visitors using the platform to complete security checks).

The specific vulnerable objects presenting a risk are:

Contact
Account
AccountContactRelation

As the website states that over ████████ every year, the extent of this leak may be affecting hundreds of thousands of users.

████

Hope you find this report helpful - look forward to your feedback.

## Impact

Large-scale user PII leak.

## System Host(s)
██████████

## Affected Product(s) and Version(s)

## CVE Numbers

## Steps to Reproduce
1. Navigate to █████
2. Append the link to ██████████
3. Register a new user, verify via email
4. Log into the portal (if not automatically logged in after following link in email and setting new password)
5. Capture a POST request to the █████ endpoint, such as one below (containing the aura.token). This will return only 2000 records - however note that Salesforce Id's are sequential and can be easily enumerated via the GetRecord Aura controller.

POST ███████?r=3&ui-comm-runtime-components-aura-components-siteforce-controller.PubliclyCacheableAttributeLoader.getComponentAttributes=1 HTTP/1.1
Host: ███
Cookie: ███
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/█████████ Firefox/119.0
Accept: */*
Accept-Language: en-GB,en;q=0.5
Accept-Encoding: gzip, deflate
Referer: ██████████t=1703212778793
X-Sfdc-Page-Scope-Id: ab32d6b8-b3fc-4612-8bc1-3b0c8163e8f0
X-Sfdc-Request-Id: 251200000054548e63
X-Sfdc-Page-Cache: 44256e663456d3d8
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Content-Length: 1336
Origin: █████████
Dnt: 1
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
Te: trailers
Connection: close

message=%7B%22actions%22%3A%5B%7B%22id%22%3A%2283%3Ba%22%2C%22descriptor%22%3A%22serviceComponent%3A%2F%2Fui.comm.runtime.components.aura.components.siteforce.controller.PubliclyCacheableAttributeLoaderController%2FACTION%24getComponentAttributes%22%2C%22callingDescriptor%22%3A%22markup%3A%2F%2Fsiteforce%3ApageLoader%22%2C%22params%22%3A%7B%22viewOrThemeLayoutId%22%3A%228c568ef8-3954-4997-930c-542a81f9e8eb%22%2C%22publishedChangelistNum%22%3A61%2C%22audienceKey%22%3A%22cp38y0onxM9f4QchAW2Mkg%22%7D%2C%22version%22%3A%2259.0%22%2C%22storable%22%3Atrue%7D%5D%7D&aura.context=%7B%22mode%22%3A%22PROD%22%2C%22fwuid%22%3A%22Q0FGdjJNU2hrWnJiekVjWXdRVlJ4d08ySzBfZjVsY04wOG9fYlRpVWRXUEEyNDYuMTUuNS0zLjAuNA%22%2C%22app%22%3A%22siteforce%3AcommunityApp%22%2C%22loaded%22%3A%7B%22APPLICATION%40markup%3A%2F%2Fsiteforce%3AcommunityApp%22%3A%22xUUH_isHmNQqCOJ9yNTV7A%22%7D%2C%22dn%22%3A%5B%5D%2C%22globals%22%3A%7B%7D%2C%22uad%22%3Afalse%7D&aura.pageURI=%2F████%2Fs%2F%3Ft%3D1703212778793&aura.token=█████..█████████

6. Modify the request as follows and send:

POST ███?r=3&ui-comm-runtime-components-aura-components-siteforce-controller.PubliclyCacheableAttributeLoader.getComponentAttributes=1 HTTP/1.1
Host: ██████████
Cookie: ██████
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/██████ Firefox/119.0
Accept: */*
Accept-Language: en-GB,en;q=0.5
Accept-Encoding: gzip, deflate
Referer: ████t=1703212778793
X-Sfdc-Page-Scope-Id: ab32d6b8-b3fc-4612-8bc1-3b0c8163e8f0
X-Sfdc-Request-Id: 251200000054548e63
X-Sfdc-Page-Cache: 44256e663456d3d8
Content-Type: application/x-www-form-urlencoded;charset=UTF-8
Content-Length: 1141
Origin: █████████
Dnt: 1
Sec-Fetch-Dest: empty
Sec-Fetch-Mode: cors
Sec-Fetch-Site: same-origin
Te: trailers
Connection: close

message={"actions":[{"id":"123;a","descriptor":"███/ACTION$getItems","callingDescriptor":"UNKNOWN","params":{"entityNameOrId":"Contact","layoutType":"FULL","pageSize":2000,"currentPage":0,"useTimeout":false,"getCount":false,"enableRowActions":false}}]}&aura.context=%7B%22mode%22%3A%22PROD%22%2C%22fwuid%22%3A%22Q0FGdjJNU2hrWnJiekVjWXdRVlJ4d08ySzBfZjVsY04wOG9fYlRpVWRXUEEyNDYuMTUuNS0zLjAuNA%22%2C%22app%22%3A%22siteforce%3AcommunityApp%22%2C%22loaded%22%3A%7B%22APPLICATION%40markup%3A%2F%2Fsiteforce%3AcommunityApp%22%3A%22xUUH_isHmNQqCOJ9yNTV7A%22%7D%2C%22dn%22%3A%5B%5D%2C%22globals%22%3A%7B%7D%2C%22uad%22%3Afalse%7D&aura.pageURI=%2F████████%2Fs%2F%3Ft%3D1703212778793&aura.token=█████████..██████████

7. Replace the value of the entityNameOrId field in the request body to test other objects (Account, AccountContactRelation, User etc)

## Suggested Mitigation/Remediation Actions
██████████
https://infosecwriteups.com/in-simple-words-pen-testing-salesforce-saas-application-part-2-fuzz-exploit-eefae11ba5ae
█████████

---

### [Mozilla Employee's Token for sql.telemetry.mozilla.org Exposed in Git Commit](https://hackerone.com/reports/2193815)

- **Report ID:** `2193815`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Mozilla
- **Reporter:** @yakirka
- **Bounty:** - usd
- **Disclosed:** 2023-12-18T09:14:04.585Z
- **CVE(s):** -

**Summary (team):**

A Mozilla employee's API token for https://sql.telemetry.mozilla.org was leaked in one of our Github repos. The token provided access to the service dashboard which contained confidential data. The API token was rotated and removed from the service.  

Note that this asset is out of scope of our program, however, we accepted the report since the reported issue is critical.

---

### [Mozilla FuzzManager API Token Exposed in Git Commit](https://hackerone.com/reports/2030076)

- **Report ID:** `2030076`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Mozilla
- **Reporter:** @yakirka
- **Bounty:** - usd
- **Disclosed:** 2023-11-29T10:40:24.169Z
- **CVE(s):** -

**Summary (team):**

The researcher has discovered that an API token for the FuzzManager of Mozilla (https://fuzzmanager.fuzzing.mozilla.org) was leaked in one of our GitHub repositories. The API token provides access to our internal fuzzing data and results. The token was accidentally configured with read-write access, we rotated the tokens and made sure to use write-only tokens in our workers

---

### [debug.log File Exposure that exposes (user/████) username and password at █████████](https://hackerone.com/reports/2122938)

- **Report ID:** `2122938`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Mars
- **Reporter:** @skoll101
- **Bounty:** - usd
- **Disclosed:** 2023-11-15T18:42:48.670Z
- **CVE(s):** -

**Summary (team):**

Summary:

Hello Team,
I have discovered a debug.log file exposure vulnerability at █████████ . This vulnerability allows an attacker to view potentially sensitive information, including (user/██████) username and password.

Details:
The vulnerability is present at █████ of the application. When a user accesses the debug.log file, the application displays detailed information about the server , error messages and debugging information. In this case, the debug.log file contains (user/██████) username and password, which can be used by an attacker to gain unauthorised access to the application.

Steps To Reproduce:
Access the debug.log file by navigating to ███████ .
Observe that the file is accessible and contains sensitive information. you can see the screenshot below.

Recommendation:
To mitigate this vulnerability, it is recommended that you remove or restrict access to the debug.log file. This can be achieved by deleting the file, renaming it to a less obvious name, or configuring the web server to restrict access to the file. In addition, it is recommended that all exposed (user/█████) credentials be changed immediately to prevent unauthorised access.

Impact
An attacker can exploit this vulnerability to gain unauthorised access to the application using the exposed █████████ credentials. This can result in a loss of confidentiality, integrity, and availability for the affected users.
Please let me know if you require any further information or assistance.
Kind regards,

---

### [Exposed GIT repo on ██████████[HtUS]](https://hackerone.com/reports/1629822)

- **Report ID:** `1629822`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @nightm4re
- **Bounty:** - usd
- **Disclosed:** 2023-05-15T15:18:13.716Z
- **CVE(s):** -

**Vulnerability Information:**

Git metadata directory (.git) was found in this folder. An attacker can extract sensitive information by requesting the hidden metadata directory that version control tool Git creates. The metadata directories are used for development purposes to keep track of development changes to a set of source code before it is committed back to a central repository (and vice-versa). When code is rolled to a live server from a repository, it is supposed to be done as an export rather than as a local working copy, and hence this problem.

███████

```
Some of Repository files/directories:
├── private
│   ├── Gruntfile.js
│   ├── bootstrap.php
│   ├── build.js
│   ├── classes
│   │   ├── Config.php
│   │   ├── Controller.php
│   │   ├── Database.php
│   │   ├── DatabaseResult.php
│   │   ├── DatabaseResultRow.php
│   │   ├── DebugLog.php
│   │   ├── Dictionary.php
│   │   ├── FileUploader.php
│   │   ├── ImageUploader.php
│   │   ├── Importer.php
│   │   ├── Installer.php
│   │   ├── ModelController.php
│   │   ├── Modeler.php
│   │   ├── Palm
│   │   │   ├── Controller.php
│   │   │   ├── ProblemFetcher.php
│   │   │   └── Status.php
│   │   ├── PalmBrowser.php
│   │   ├── Perls
│   │   │   ├── Controller.php
│   │   │   └── UserManager.php
│   │   ├── Request.php
│   │   ├── Router.php
│   │   ├── UploadController.php
│   │   ├── UserLogin.php
│   │   ├── XmlImporter.php
│   │   └── xAPI
│   │       ├── Builder.php
│   │       ├── Controller.php
│   │       └── Logger.php
│   ├── config.json
│   ├── controllers
│   │   ├── Author
│   │   │   ├── Applications.php
│   │   │   ├── Categories.php
│   │   │   ├── DefaultParameters.php
│   │   │   ├── Globals.php
│   │   │   ├── Images.php
│   │   │   ├── Lists.php
│   │   │   ├── Modules.php
│   │   │   ├── ProblemLayouts.php
│   │   │   ├── ProblemTemplates.php
│   │   │   ├── Problems.php
│   │   │   ├── Publish.php
│   │   │   ├── Tags.php
│   │   │   ├── Unpublish.php
│   │   │   ├── UploadImage.php
│   │   │   └── Users.php
│   │   ├── Import
│   │   │   ├── Parse.php
│   │   │   └── Submit.php
│   │   ├── Palm
│   │   │   ├── Browse.php
│   │   │   ├── Load.php
│   │   │   ├── Problem.php
│   │   │   ├── Reset.php
│   │   │   └── Sequence.php
│   │   ├── Perls
│   │   │   ├── ListModules.php
│   │   │   ├── ProbeProblems.php
│   │   │   ├── RequestPalm.php
│   │   │   ├── SampleProblems.php
│   │   │   └── UserStatus.php
│   │   ├── User
│   │   │   ├── ConfirmEmail.php
│   │   │   ├── Consent.php
│   │   │   ├── Login.php
│   │   │   ├── Logout.php
│   │   │   ├── Register.php
│   │   │   ├── ResetPassword.php
│   │   │   ├── Save.php
│   │   │   ├── Touch.php
│   │   │   ├── Unique.php
│   │   │   └── VerifyEmail.php
│   │   └── xAPI
│   │       ├── Categories.php
│   │       ├── Modules.php
│   │       ├── Problems.php
│   │       ├── Statements.php
│   │       └── Users.php
│   ├── install.xml
│   ├── models
│   │   ├── Applications.php
│   │   ├── Categories.php
│   │   ├── FileTags.php
│   │   ├── GlobalParameters.php
│   │   ├── ImageTypes.php
│   │   ├── Images.php
│   │   ├── Lists.php
│   │   ├── Modules.php
│   │   ├── ProblemLayouts.php
│   │   ├── ProblemTemplates.php
│   │   ├── Problems.php
│   │   └── Users.php
│   ├── package.json
│   ├── sql
│   │   ├── application_parameters.sql
│   │   ├── applications.sql
│   │   ├── categories.sql
│   │   ├── category_parameters.sql
│   │   ├── category_prerequisites.sql
│   │   ├── completed_modules.sql
│   │   ├── file_tags.sql
│   │   ├── global_parameters.sql
│   │   ├── image_tag_map.sql
│   │   ├── image_types.sql
│   │   ├── images.sql
│   │   ├── lists.sql
│   │   ├── module_parameters.sql
│   │   ├── modules.sql
│   │   ├── performances.sql
│   │   ├── priorities.sql
│   │   ├── problem_graph.sql
│   │   ├── problem_layouts.sql
│   │   ├── problem_parameters.sql
│   │   ├── problem_templates.sql
│   │   ├── problems.sql
│   │   ├── problems_logged.sql
│   │   ├── retired_categories.sql
│   │   ├── user_authentication.sql
│   │   ├── user_status.sql
│   │   ├── users.sql
│   │   └── xapi_statements.sql
│   └── vendor
│       └── TinCanPHP
│           ├── About.php
│           ├── Activity.php
│           ├── ActivityDefinition.php
│           ├── ActivityProfile.php
│           ├── Agent.php
│           ├── AgentAccount.php
│           ├── AgentProfile.php
│           ├── Attachment.php
│           ├── Context.php
│           ├── ContextActivities.php
│           ├── Document.php
│           ├── Extensions.php
│           ├── Group.php
│           ├── LRSInterface.php
│           ├── LRSResponse.php
│           ├── LanguageMap.php
│           ├── Map.php
│           ├── Object.php
│           ├── RemoteLRS.php
│           ├── Result.php
│           ├── Score.php
│           ├── State.php
│           ├── Statement.php
│           ├── StatementBase.php
│           ├── StatementRef.php
│           ├── StatementTargetInterface.php
│           ├── StatementsResult.php
│           ├── SubStatement.php
│           ├── Util.php
│           ├── Verb.php
│           ├── Version.php
│           └── VersionableInterface.php
```

Also the config.json file is expsing senstive infomration
```
{
    // ----------------------------------------------------------------------------------
    // Authoring Tools config file
    // This file is in a JSON format, but comments are allowed.  Make sure all values
    // follow correct JSON syntax.
    // ----------------------------------------------------------------------------------

    // URL_BASE
    // The absolute url prefix to the root of the site.  For example, if the root of the
    // site is at "http://localhost/~fred/site/", the value would be "/~fred/site/".
    // The default value is the domain root, or "/".

    "URL_BASE":                 "/",

    // FORCE_SSL
    // Forces all connections and internal redirects to https.

    "FORCE_SSL":                false,

    // DEBUG_DISPLAY
    // Setting this to true will enable the debug log to be displayed and passed back
    // through AJAX responses

    "DEBUG_DISPLAY":            false,

    // DEBUG_EMAIL_ADDRESSES
    // Array of email addresses to send debug log messages to.

    "DEBUG_EMAIL_ADDRESSES":    [],

    // DEBUG_EMAIL_LEVELS
    // Array of debug log levels to trigger debug emails.  Emails are only sent if an
    // item was logged at that level, and if at least one email address (see above) is
    // set.

    "DEBUG_EMAIL_LEVELS":       ["ERROR"],

    // DEBUG_CAPTURE_ERRORS
    // If true, PHP errors (notices, warnings, etc.) will be captured and inserted into
    // the debug log using a custom error handler.  Otherwise, they will be handled
    // according to the PHP configuration settings.  Fatal errors are not captured.

    "DEBUG_CAPTURE_ERRORS":     true,

    // FORCE_UNBUILT_RESOURCES
    // This forces the use of the unbuilt JavaScript and CSS for the site.  Otherwise,
    // the site will use the built files automatically if they are detected in the build
    // directory.

    "FORCE_UNBUILT_RESOURCES":  false,

    // DATABASE_HOST
    // Database host to connect to

    "DATABASE_HOST":            "localhost",

    // DATABASE_USER
    // Name of the database user to connect as

    "DATABASE_USER":            "authoring_tools",

    // DATABASE_PASSWORD
    // Password to connect with

    "DATABASE_PASSWORD":        "████",

    // DATABASE_NAME
    // Name of the Authoring Tools database

    "DATABASE_NAME":            "authoring_tools",

    // INSTALLER_ENABLED
    // Set this to true to enable access to the database installation script located at
    // '/install.php'.  Once the installer has been run and the site is running correctly,
    // reset this back to false to prevent further access.

    "INSTALLER_ENABLED":        false,

    // SYSTEM_EMAIL
    // The originating email address for all system emails (e.g. account validation).
    // Setting this to an appropriate value can help prevent messages from being
    // filtered as spam.

    "SYSTEM_EMAIL":            "no-reply@example.com",

    // BLOCK_SIZE
    // The number of trials per block

    "BLOCK_SIZE":               10,

    // XAPI_LOCAL_STATEMENTS
    // Set this to true to store xAPI statements in the Authoring Tools database.  This
    // will potentially incur a cost in database storage, since many statements may be
    // generated.

    "XAPI_LOCAL_STATEMENTS":    false,

    // XAPI_REMOTE_LRS_ENDPOINT
    // Base URL for remote LRS to send statement data to.  If null, no data is sent.

    "XAPI_REMOTE_LRS_ENDPOINT": null,

    // XAPI_REMOTE_LRS_USER
    // Username for authenticating connection with remote LRS (as specified in
    // XAPI_REMOTE_LRS_ENDPOINT)

    "XAPI_REMOTE_LRS_USER":     "",

    // XAPI_REMOTE_LRS_PASSWORD
    // Password for authenticating connection with remote LRS (as specified in
    // XAPI_REMOTE_LRS_ENDPOINT)

    "XAPI_REMOTE_LRS_PASSWORD":  "",

    // PERLS_SECRET_KEY
    // PERLS access key for embedding modules and authenticating users.  Set this to a
    // string value that the PERLS system must send with the request as the 'key'
    // parameter.  If set to true, access will be allowed without any secret key.  Null
    // or false will disable PERLS access.

    "PERLS_SECRET_KEY":         null,

    // PARAMETER_DEFAULTS
    // Default values for global parameters

    "PARAMETER_DEFAULTS":
    {
        "delay_constant":       2.0,
        "default_weight":       1.0,
        "rt_weight":            0.1,
        "incorrect_penalty":    2.0,
        "rt_divisor":           1000,
        "window":               3,
        "target_accuracy":      1.0,
        "target_rt":            10000,
        "timeout":              30000
    }
}
```

## Impact

These files may expose sensitive information that may help an malicious user to prepare more advanced attacks

---

### [Cleartext storage of sensitive information at https://staging.status.ai-apps-comms.ibm.com/env can lead to account takeover  of several IBM employees](https://hackerone.com/reports/1670586)

- **Report ID:** `1670586`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** IBM
- **Reporter:** @zere
- **Bounty:** - usd
- **Disclosed:** 2022-09-09T15:14:19.139Z
- **CVE(s):** -

**Summary (team):**

Cleartext storage of sensitive information was reported to IBM, analyzed and has been remediated. Thank you to zere.

---

### [Sensitive Information Disclosure Through Config File](https://hackerone.com/reports/1397788)

- **Report ID:** `1397788`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** MTN Group
- **Reporter:** @dh0pe
- **Bounty:** - usd
- **Disclosed:** 2022-09-01T20:50:48.872Z
- **CVE(s):** -

**Vulnerability Information:**

## Summary:
An attacker could gain access to sensitive information about usernames, encrypted passwords, internal IP addresses and configuration data of internal services.

## Steps To Reproduce:
- Go to https://zik.mtncameroon.net/common/queryconfig.action

## Remediation
Configure the application to not reveal sensitive information to client.

## References
https://cwe.mitre.org/data/definitions/200.html

## Impact

A malicious user is able to gain sensitive information usernames, encrypted passwords, internal IP addresses and configuration data of internal services.

---

### [████ api key exposed in github.com/███/███](https://hackerone.com/reports/1454965)

- **Report ID:** `1454965`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** 8x8
- **Reporter:** @adnanmalikinfo
- **Bounty:** - usd
- **Disclosed:** 2022-02-22T07:19:03.629Z
- **CVE(s):** -

**Summary (team):**

@adnanmalikinfo identified a committed API key of a 3rd party SaaS platform for social marketing.
We swiftly escalated to the repository owner, who restricted access.

---

### [Critical || Unrestricted access to private Github repos and properties of Elastic through leaked token of Elastic employee](https://hackerone.com/reports/1266188)

- **Report ID:** `1266188`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Elastic
- **Reporter:** @prateek_0490
- **Bounty:** - usd
- **Disclosed:** 2021-09-01T17:40:58.156Z
- **CVE(s):** -

**Summary (team):**

@prateek_0490 was able to gain access to private Github repositories through a leaked Github token on bitbucket. We confirmed this token was valid, and have rotated.

---

### [Leaking Rockset API key on Github](https://hackerone.com/reports/1094151)

- **Report ID:** `1094151`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Rockset
- **Reporter:** @fonte
- **Bounty:** - usd
- **Disclosed:** 2021-03-02T16:02:20.439Z
- **CVE(s):** -

**Vulnerability Information:**

## Summary:
We all know that Github is great, but it runs the risk of some credentials being revealed by mistake. In this case I found a Rockset API key, This API key is not in the current code, but it is visible in an old commit.

## Steps To Reproduce:
You can find the leak in this link : https://github.com/rockset/recipes/pull/19/files

```
        /* Getting the distance covered by each vehicle using the latest and oldest locations */
        distance_for_vehicles AS (
        SELECT
            ST_DISTANCE(
@@ -128,7 +147,7 @@
    'q4': query4 
}

api_key = "skZMJRZSXLZZj5HAdBjNxUfZbarWV5dLqfVO6U623zW5KROzfY0vNRa22ToZfRRe"
```

Then I visited the documentation of Rockset ( https://docs.rockset.com/rest-api/ ) and I found this way to check if the API key is revoke or not
```
curl --request GET \
    --url https://api.rs2.usw2.rockset.com/v1/orgs/self/users/self/apikeys \
    -H 'Authorization: ApiKey skZMJRZSXLZZj5HAdBjNxUfZbarWV5dLqfVO6U623zW5KROzfY0vNRa22ToZfRRe'
```
and I got this answer:
```
{"data":[{"created_at":"2019-10-22T06:08:37Z","name":"K1","key":"skZMJRZSXLZZj5HAdBjNxUfZbarWV5dLqfVO6U623zW5KROzfY0vNRa22ToZfRRe","last_access_time":null,"created_by":null}]}
```
So I could verify that it was not revoked

## Impact

I just checked that the key was not revoked. I didn't try anything with the token  to be prudent, and I don't know the real impact of this, But I think it is a good idea to share this with you, to avoid any risk that may grow.

Regards!

---

### [Development Application Credentials + Information Exposed](https://hackerone.com/reports/1018413)

- **Report ID:** `1018413`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Kubernetes
- **Reporter:** @lmhu
- **Bounty:** - usd
- **Disclosed:** 2020-12-03T19:01:21.042Z
- **CVE(s):** -

**Vulnerability Information:**

**Issue Description**
When I browsed through all the JS files on prow.k8s.io I came across a link called **/config** which contains a configuration disclosure for the development files

**URL Vulnerabilities**
https://prow.k8s.io/config

**Proof On Concept**
```javascript
- continuous-integration/travis-ci
kubespray:
required_status_checks:
contexts:
- Kubespray CI Pipeline
required_status_checks:
contexts:
- cla/linuxfoundation

- kubernetes-security
  rerun_auth_configs:
    '*':
      github_team_ids:
      - 2009231
      - 2460384
  spyglass:
    gcs_browser_prefix: https://gcsweb.k8s.io/gcs/
    gcs_browser_prefixes:
      '*': https://gcsweb.k8s.io/gcs/
    lenses:
    - lens:
        name: metadata
      optional_files:
      - ^(?:podinfo|prowjob)\.json$
      remote_config:
        endpoint: http://127.0.0.1:1234/dynamic/metadata
        hide_title: true
        priority: 0
        static_root: ""
        title: Metadata
      required_files:
      - ^(?:started|finished)\.json$
    - lens:
        config:
          highlight_regexes:
          - timed out
          - 'ERROR:'
          - (FAIL|Failure \[)\b
          - panic\b
          - ^E\d{4} \d\d:\d\d:\d\d\.\d\d\d]
          - '^INFO: Analyzed \d+ targets'
        name: buildlog
      remote_config:
        endpoint: http://127.0.0.1:1234/dynamic/buildlog
        hide_title: false
        priority: 10
        static_root: ""
        title: Build Log
      required_files:
      - ^.*build-log\.txt$
```

## Impact

Information Exposed + File Configuration Disclosure

---

### [Sensitive information about a ██████](https://hackerone.com/reports/893970)

- **Report ID:** `893970`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @0x9747
- **Bounty:** - usd
- **Disclosed:** 2020-09-21T14:49:17.901Z
- **CVE(s):** -

**Vulnerability Information:**

**Summary:**
https://████████/ is an U.S. Government (USG) Information System (IS) that is provided for USG-authorized use only.Due to some reason a document  which contains the information about a special ███ for the ████  █████ which possibly is ███████or █████.The pdf file is located at https://██████/spi/█████████.pdf and also contains some drawings for the packaging of the machine.

To confirm that it indeed was a confidential document it was found that a basic search related to this pdf returns a meta info containing a label about criminal penalties for foreign export:

"WARNING – This document contains technical data whose export is restricted by the Arms Export Control Act (Title 22, U.S.C., Sec 2751 et seq.) or the Export Administration Act of 1979, (Title 50, U.S.C., App. 2401 et seq.), as amended. Violations of these export laws are subject to severe criminal penalties. Disseminate in accordance with provisions of DoD Directive 5230.25."

To confirm that the file is not just another special ██████████ it was discovered that the SPI number is not labeled at https://███/████████/spi?OpenPage&TableRow=2.1.1#2.1.

## Step-by-step Reproduction Instructions

1.Open any browser of your choice 
2.Head over to https://███████/spi/███████.pdf
3.Observe the content listed in the pdf and analyse the products mentioned in there

## Product, Version, and Configuration (If applicable)
Null
## Suggested Mitigation/Remediation Actions
Removal of such documents or introduction of certain authentication mechanisms would be ideal.

## Impact

This exposes highly sensitive information about not just the packaging info but also the designs mentioned.
Any person can access this document and cause information leakage.

---

### [PII/PHI data available on web https://████████Portals/22/Documents/Meetings](https://hackerone.com/reports/877598)

- **Report ID:** `877598`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @pvm
- **Bounty:** - usd
- **Disclosed:** 2020-06-25T13:05:56.752Z
- **CVE(s):** -

**Vulnerability Information:**

**Summary:**
https://███Portals/22/Documents/Meetings contains many internal documents which likely were reviewed on meeting/meetings preparations which should not be available for public but searchable via google/bing.  Documents include: resumes, bio data form, emails (including history of medical conditions), mails, letters. 
PII/PHI exposed: name, emails, phones, medical history/condition.

**Description:**
https://███████Portals/22/Documents/Meetings contains many internal documents which likely were reviewed on meeting/meetings preparations which should not be available for public but searchable via google/bing.  Documents include: resumes, bio data form, emails (including history of medical conditions), mails. 
PII exposed: name, emails, phones, medical history/condition.
Here you can see some examples:
- Detailed resume: https://█████████Portals/22/Documents/Meetings/m14/█████████.pdf
- long email thread including official letters (name, email, medical conditions, phone): https://█████Portals/22/Documents/Meetings/m18/████████.pdf
- Internal emails (names, emails, phones): https://██████████Portals/22/Documents/Meetings/m11/██████████.pdf
- email (name, email, medical conditions, phone): https://██████████Portals/22/Documents/Meetings/m11/█████████.pdf
- email (name, email, medical conditions, phone): https://█████████Portals/22/Documents/Meetings/m19/██████████.pdf
- an attorney email (name, email, medical conditions): https://████████Portals/22/Documents/Meetings/m13/█████████.pdf
- letter (name, medical condition): https://█████████Portals/22/Documents/Meetings/m17/████.pdf
- email/letter with medical condition: https://████████Portals/22/Documents/Meetings/m18/██████████.pdf
- statement: https://████████Portals/22/Documents/Meetings/m19/█████.pdf 
- memorandum: https://███████Portals/22/Documents/Meetings/m11/██████████.pdf
- biographic data form: https://██████████Portals/22/Documents/Meetings/m18/██████████.pdf
- biographic data form: https://█████████Portals/22/Documents/Meetings/m19/███████.pdf

Also here I've found many biographies of medical officers  with different level of details. Some of them are very detailed.

## Impact
High or Critical. 
Because of PII/PHI exposed: name, emails, phones, medical history/condition. 

## Step-by-step Reproduction Instructions

- Perform a search on Bing: site: ███ AND "https://██████████Portals/22/Documents/Meetings/" 
- OR navigate to the provided links:
  - Detailed resume: https://███████Portals/22/Documents/Meetings/m14/█████.pdf
  - long email thread including official letters (name, email, medical conditions, phone): https://███Portals/22/Documents/Meetings/m18/█████.pdf
  - Internal emails (names, emails, phones): https://███████Portals/22/Documents/Meetings/m11/██████.pdf
  - email (name, email, medical conditions, phone): https://████Portals/22/Documents/Meetings/m11/███████.pdf
  - email (name, email, medical conditions, phone): https://█████████Portals/22/Documents/Meetings/m19/███.pdf
  - an attorney email (name, email, medical conditions): https://██████Portals/22/Documents/Meetings/m13/███████.pdf
  - letter (name, medical condition): https://██████Portals/22/Documents/Meetings/m17/████.pdf
  - email/letter with medical condition: https://█████████Portals/22/Documents/Meetings/m18/███.pdf
  - statement: https://████████Portals/22/Documents/Meetings/m19/██████████.pdf 
  - memorandum: https://█████████Portals/22/Documents/Meetings/m11/██████.pdf
  - biographic data form: https://██████Portals/22/Documents/Meetings/m18/██████.pdf
  - biographic data form: https://███████Portals/22/Documents/Meetings/m19/█████████.pdf
## Product, Version, and Configuration (If applicable)
N/A
## Suggested Mitigation/Remediation Actions
Remove thee files or restrict access to them. Other files in the folders should be evaluated.

## Impact

High or Critical. 
Because of PII/PHI exposed: name, emails, phones, medical history/condition.

---

### [SSN is exposed on slides, previous critical report was not fixed in an appropriate way](https://hackerone.com/reports/874017)

- **Report ID:** `874017`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @pvm
- **Bounty:** - usd
- **Disclosed:** 2020-06-11T18:19:46.012Z
- **CVE(s):** -

**Vulnerability Information:**

**Summary:**
SSN is exposed on slides, previous critical report was not fixed in an appropriate way

**Description:**
1. SSN is exposed on a screenshot. Slide 13th. SSN is covered by an olive/green rectangle which is moveable. The image itself was not updated. 
██████wp-content/uploads/2018/12/████████

2. The issue was previously submitted and was not fixed in an appropriate way.
https://hackerone.com/reports/█████████

3. The file is easy to find by the file name.
https://duckduckgo.com/?q=%22███%22&t=hj&ia=web

## Impact
Critical
███████ is a real person (officer) according to  ██████████

## Step-by-step Reproduction Instructions
1. Download the file ████████wp-content/uploads/2018/12/█████
2. Navigate to slide 13
3. Move the olive rectangle which covers SSN

## Product, Version, and Configuration (If applicable)
N/A

## Suggested Mitigation/Remediation Actions
Blur/remove/cover the SSN on the image and replace the image on the slides.

## Impact

PII leakage. Name and SSN.

---

### [Sensitive Information Leaking Through Navy Website. [█████]](https://hackerone.com/reports/812585)

- **Report ID:** `812585`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** U.S. Dept Of Defense
- **Reporter:** @rootuser
- **Bounty:** - usd
- **Disclosed:** 2020-05-14T17:59:19.800Z
- **CVE(s):** -

**Vulnerability Information:**

**Summary:**
 While performing recon work on websites owned by DoD i came up with a Navy website which is leaking sensitive information.

**Description:**
The website is leaking information such as- first name and last name, email address, phone number, location, rank, and other information of trainees in a clear readable pdf document. This is a high severity issue and requires immediate fixation. It is also a clear privacy violation and insufficient protection mechanism involved in data storage.
 
## Step-by-step Reproduction Instructions

1. Open a web browser of your choice.
2. Now open this URL: https://███████/sites/██████/Documents/health-promotion-wellness/reproductive-and-sexual-health/██████████

## Suggested Mitigation/Remediation Actions
Remove document from the internet or put applicable authorization mechanism(s) in order to access sensitive documents.

## Impact

Any person can access this document and cause:
1. Information leakage.
2. Impersonation a person.
3. Commit crimes under a fake identity.

---

### [AppLovin API Key hardcoded in a Github repo](https://hackerone.com/reports/674774)

- **Report ID:** `674774`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** X / xAI
- **Reporter:** @hackbotone_
- **Bounty:** 280 usd
- **Disclosed:** 2019-09-18T22:01:53.543Z
- **CVE(s):** -

**Vulnerability Information:**

Hello,
I found a Sensitive Data Exposure in github/mopub-android-mediation project, the AppLovin UI API key is hardcoded in source code. 

And in the comment it's mentioned that 
##"This is a unique SDK Key from AppLovin. Get yours from the AppLovin UI".

Github Link:- https://github.com/mopub/mopub-android-mediation/blob/72804166ec9f3b79cc0dcfa96bd8c813f3252794/Testing/src/main/AndroidManifest.xml#L60

Google Ads SDK reference link:- https://developers.google.com/admob/android/mediation/applovin

Thanks
Anshuman Pattnaik

## Impact

So if it's a production API key then it shouldn't be shown publicly in Github repo otherwise it can be used by other developers as it's a company property the API key should be secure as it's a monetize API key.

---

### [Production secret key leak in config/secrets.yml](https://hackerone.com/reports/456997)

- **Report ID:** `456997`
- **Severity:** High
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Grab
- **Reporter:** @phreak
- **Bounty:** - usd
- **Disclosed:** 2019-01-08T07:55:23.269Z
- **CVE(s):** -

**Vulnerability Information:**

**Summary:** 
Production secret key leak in config/secrets.yml

**Description:** 
In Github, http://engineering.grab.com/ secret_key_base is leaked which is present in the config/secrets.yml

## Steps To Reproduce:

  1. Go to the below GitHub URL and we can verify that secret_key_base is present.
```
https://github.com/grab/blogs/blob/master/2017-01-29-deep-dive-into-database-timeouts-in-rails/config/secrets.yml
```

Mitigation:-
```
https://medium.com/@thejasonfile/hide-your-api-keys-hide-your-skype-api-keys-884427746f9c
```

## Impact

Proper Impact is explained here:-
https://stackoverflow.com/questions/44220691/rails-what-are-the-consequences-of-a-leaked-secret-key-base

**Summary (team):**

We have recently received a lot of duplicate reports related to keys specified in the following URL:

`https://github.com/grab/blogs/blob/master/2017-01-29-deep-dive-into-database-timeouts-in-rails/config/secrets.yml`

The given keys are demo boilerplate that has been used to explain *Database Timeouts in Rails* blog post at our Grab Engineering blog and is not used any where in production.

---

### [Github Token Leaked publicly for https://github.sc-corp.net](https://hackerone.com/reports/396467)

- **Report ID:** `396467`
- **Severity:** Critical
- **Weakness:** Cleartext Storage of Sensitive Information
- **Program:** Snapchat
- **Reporter:** @th3g3nt3lman
- **Bounty:** - usd
- **Disclosed:** 2018-10-08T12:57:23.028Z
- **CVE(s):** -

**Vulnerability Information:**

###Description :

GitHub is a truly awesome service but it is unwise to put any sensitive data in code that is hosted on GitHub and similar services as i was able to find github token indexed ***7 hours Ago*** by user ***██████ - Software Engineer - Snap Inc***

### Issue & POC :
You can find the leak in this link :
https://github.com/█████/leetcode/blob/0eec6434940a01e490d5eecea9baf4778836c54e/TopicMatch.py

````

import os
import requests
import sys
pull_number = 76793
pull_url = "https://github.sc-corp.net/api/v3/repos/Snapchat/android/pulls/" + str(pull_number)
payload = {}
payload["Authorization"] = "token " + "9db9ca3440e535d90408a32a9c03d415979da910"
print payload
r = requests.get(pull_url,

```

## Impact

I didn't try anything with the token, and dont know what access it has, and i know that in order to login to https://github.sc-corp.net you need to have an email @snap but still i though it would be a good idea to share this finding with you in case it can be used in a way that i dont know.

Best Regards

---
