#include<iostream>
#include<string>
using namespace std;
//只需求next 数组，然后 n - next[n] 即可。
string s;
int next1[1000003];
void calu(string s, int l) {
    next1[0] = -1;
    int k = 0;
    int t = -1;
    while (k <= l) {
        while (t >= 0 && s[t] != s[k]) {
            t = next1[t];
        }
        k++;
        t++;
        if (k > l) {
            break;
        }
        else {
            next1[k] = t;
        }
    }
}

int main() {
    cin >> s;
    while (s != ".") {
        int length = s.length();
        s += '.';
        calu(s, length);
        int ans = length/(length-next1[length]);
        if (length % (length - next1[length]) != 0) {
            ans = 1;
        }
        cout << ans << endl;
        cin >> s;
    }
    return 0;
}