#include<iostream>
#include<string>
using namespace std;
long long a[60000];
long long sum[60000];
//string b = "11212312341234512345612345671234567812345678912345678910123456789101112345678910";
int main() {
    for (int i = 1; i <= 60000; i++) {
        if (i < 10) {
            a[i] = i;
        }
        else if (i < 100) {
            a[i] = 9 + (i - 9) * 2;
        }
        else if (i < 1000) {
            a[i] = 9 + 180 + (i - 99) * 3;
        }
        else if (i < 10000) {
            a[i] = 9 + 180 + 2700 + (i - 999) * 4;
        }
        else {
            a[i] = 9 + 180 + 2700 + 36000 + (i - 9999) * 5;
        }
    }
    sum[0] = 0;
    int max_pos=0;
    for (int i = 1; i <= 59999; i++) {
        sum[i] = sum[i - 1] + a[i];
        if (sum[i] >0x7fffffff) {
            max_pos = i - 1;
            break;
        }
    }
    int t;
    cin >> t;
    long long idx;
    //cout << a[max_pos+1] << " " << sum[max_pos+1] << endl;
    for (int i = 0; i < t; i++) {
        cin >> idx;
        int excess=0;
        if (idx == 1) {
            cout << 1 << endl;
            continue;
        }
        for (int j = 1; j <= max_pos + 1; j++) {
            if (idx > sum[j] && idx <= sum[j + 1]) {
                excess = idx - sum[j];
                break;
            }
        }
        int acc_exc=0;
        int next_num=0;
        if (excess == 1) {
            cout << 1 << endl;
            continue;
        }
        for (int j = 1; j <= max_pos + 1; j++) {
            if (excess > a[j] && excess <= a[j + 1]) {
                acc_exc = excess - a[j];
                next_num = j + 1;
                break;
            }
        }
        cout << (to_string(next_num)[acc_exc - 1])<< endl;
    }
    //cout << max_pos << endl;
}