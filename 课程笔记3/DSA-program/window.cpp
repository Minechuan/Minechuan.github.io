#include<iostream>
using namespace std;
int arr[1000006] = {};
int minstack[1000006] = {};
int maxstack[1000006] = {};
int minans[1000002] = {};
int maxans[1000002] = {};
int minleft = 0;
int minright = 0;
int maxleft = 0;
int maxright = 0;
void push(int new_one_idx) {
    while (maxright >= maxleft&&arr[maxstack[maxright]] < arr[new_one_idx]) {
        maxright -= 1;
    }
    while (minright >= minleft&&arr[minstack[minright]] > arr[new_one_idx]) {
        minright -= 1;
    }
    maxright++;
    minright++;
    maxstack[maxright] = new_one_idx;
    minstack[minright] = new_one_idx;
}
int main() {
    int n, k;

    cin >> n >> k;
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
    }
    //initialize stack
    maxstack[0] = 0;
    minstack[0] = 0;
    for (int i = 1; i <= k - 1; i++) {
        push(i);
    }
    minans[0] = arr[minstack[minleft]];
    maxans[0] = arr[maxstack[maxleft]];
    // the number of status;
    int move_status = n - k + 1;
    for (int i = 1; i < move_status; i++) {
        // the current position of left edge of the window
        int new_one_idx = k + i - 1;
        if (maxstack[maxleft] < i)
            maxleft++;
        if (minstack[minleft] < i)
            minleft++;
        push(new_one_idx);
        
        maxans[i] = arr[maxstack[maxleft]];
        minans[i] = arr[minstack[minleft]];
    }
    for (int i = 0; i < move_status; i++) {
        cout << minans[i] << ' ';
    }
    cout << endl;
    for (int i = 0; i < move_status; i++) {
        cout << maxans[i] << ' ';
    }
    cout << endl;
    return 0;
}