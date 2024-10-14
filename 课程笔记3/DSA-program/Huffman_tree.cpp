#include<iostream>
#include<algorithm>
using  namespace std;
int n;
int input_array[102];
void insert_to_array(int len, int val) {// insert the cooperate node to correct pos the input_array
    input_array[len] = val;
    for (int i = len - 1; i >= 0; i--) {
        if (input_array[i] < val) {
            input_array[i + 1] = input_array[i];
            input_array[i] = val;
        }
        else {
            break;
        }
    }
}
int calu() {
    sort(input_array, input_array + n, greater<int>());
    int cur_pointer = n - 1;
    //extend_node array[102];//store the length of path from each node to the root.
    /*No need to store length*/
    int accumulate = 0;
    while (cur_pointer > 0) {// think how to record the length of each extend node.
        cur_pointer--;
        int new_node = input_array[cur_pointer] + input_array[cur_pointer + 1];
        accumulate += new_node;
        insert_to_array(cur_pointer, new_node);
    }
    return accumulate;
}

int main() {
    int case_num;
    cin >> case_num;
    for (int i = 0; i < case_num; i++) {
        cin >> n;
        for (int j = 0; j < n; j++) {
            cin >> input_array[j];
        }
        int ans = calu();
        cout << ans << endl;
    }
    return 0;
}