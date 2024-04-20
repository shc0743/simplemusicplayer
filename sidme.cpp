#include <Windows.h>
#include <iostream>
#include <string>
#include <sstream>
using namespace std;

#pragma comment(lib, "kernel32.lib")
#pragma comment(lib, "advapi32.lib")

string GetCurrentUserSecurityId()
{
    constexpr int MAX_NAME = 260;
    char userName[MAX_NAME] = "";
    char sid[MAX_NAME] = "";
    stringstream ss;
    DWORD nameSize = sizeof(userName);
    GetUserNameA((LPSTR)userName, &nameSize);

    char userSID[MAX_NAME] = "";
    char userDomain[MAX_NAME] = "";
    DWORD sidSize = sizeof(userSID);
    DWORD domainSize = sizeof(userDomain);

    SID_NAME_USE snu;
    LookupAccountNameA(NULL,
                       (LPSTR)userName,
                       (PSID)userSID,
                       &sidSize,
                       (LPSTR)userDomain,
                       &domainSize,
                       &snu);

    PSID_IDENTIFIER_AUTHORITY psia = GetSidIdentifierAuthority(userSID);
    // sidSize = sprintf(sid, "S-%lu-", SID_REVISION);
    // sidSize += sprintf(sid + strlen(sid), "%-lu", psia->Value[5]);
    ss << "S-" << SID_REVISION << "-" << int(psia->Value[5]);

    int i = 0;
    int subAuthorities = *GetSidSubAuthorityCount(userSID);

    for (i = 0; i < subAuthorities; i++)
    {
        ss << "-" << (*GetSidSubAuthority(userSID, i));
    }

    // printf("current sid is %s\n", sid);
    return ss.str();
    ;
}

int APIENTRY wWinMain(_In_ HINSTANCE hInstance,
                      _In_opt_ HINSTANCE hPrevInstance,
                      _In_ LPWSTR lpCmdLine,
                      _In_ int nCmdShow)
{
    cout << GetCurrentUserSecurityId();
    return 0;
}
