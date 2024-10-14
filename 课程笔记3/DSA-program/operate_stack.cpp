#include<iostream>
using namespace std;
int arr[1000000];
int stack[1000000];
int op[1000000];
int top = 0;

int main() {
    int op_num = 0;
    int n;
    cin >> n;
    for (int i = 0; i < n; i++) {
        cin >> arr[i];
        if (arr[i] > n) {
            cout << "NO" << endl;
            return 0;
        }
    }
    op[op_num] = 1;// record the procedure
    stack[0] = 1;
    //push -> positive number
    //pop -> negative number
    int k = 2;
    //k the natural number processed current position
    for (int i = 0; i < n; ) {
        // every time of the loop, pop a correct number in the array;
        if (arr[i] < k) {
            if (stack[top] == arr[i]) {
                top -= 1;
                op_num += 1;
                op[op_num] = -arr[i];
            }
            else {
                cout << "NO" << endl;
                return 0;
            }
            i += 1;//process next number
            continue;
        }
        while (arr[i] >= k) {
            //need to push some element
            top += 1;
            op_num += 1;
            //push k
            stack[top] = k;
            op[op_num] = k;
            k++;
        }
    }
    for (int i = 0; i <= op_num; i++) {
        if (op[i] > 0) {
            cout << "PUSH " << op[i] << endl;
        }
        else {
            cout << "POP " << -op[i] << endl;
        }
    }
    return 0;
}