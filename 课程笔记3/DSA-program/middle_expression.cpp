#include<iostream>
#include<string>
using namespace std;
int idx;
string input_array[620];
string post_fit_array[620];
template<class T>//TODO
class Stack {
private:
    T arr[601];
    int size;
public:
    Stack() {
        size = 0;
    }
    void push(T s);
    bool pop();
    T top();
    bool empty();
};
template<class T>
void Stack<T>::push(T s) {
    if (this->size > 600) {
        cout << "out of memory" << endl;
    }
    this->arr[this->size] = s;
    this->size++;
}
template<class T>
bool Stack<T>::pop() {
    if (this->size <= 0) {
        return false;
    }
    this->size--;
    return true;
}
template<class T>
T Stack<T>::top() {
    if (this->size <= 0) {
        cout << "no elements" << endl;
    }
    return this->arr[this->size - 1];
}
template<class T>
bool Stack<T>::empty() {//if
    return !size;
}

void input_store() {
    string rand;
    cin >> rand;
    int len = rand.length();
    string temp_string = "";
    idx = 0;
    for (int i = 0; i < len; i++) {
        //find and form number
        if (rand[i] < '0' || rand[i]>'9') {//not number
            
            if (temp_string != "")
            {
                input_array[idx] = temp_string;
                idx++;
                temp_string = "";
                input_array[idx] = rand[i];
                idx++;
            }
            else {
                input_array[idx] = rand[i];
                idx++;
            }
        }
        else {
            temp_string += rand[i];
        }
    }
    if (temp_string != "") {
        input_array[idx] = temp_string;
        idx++;
    }
}
int kuohao_num = 0;
void transform_to_back() {
    //
    int postfitIdx = 0;
    Stack<string>* transfer = new Stack<string>;
    for (int i = 0; i < idx; i++) {
        if (input_array[i][0] >= '0' && input_array[i][0] <= '9') {//operation number
            post_fit_array[postfitIdx] = input_array[i];
            postfitIdx++;
        }
        else if (input_array[i] == "(") {//如果为开括号
            kuohao_num += 2;
            transfer->push("(");
        }
        else if (input_array[i] == ")") {//如果为闭括号
            if (transfer->empty()) {
                cout << "run_case" << endl;
                return;
            }
            else {
                string a = transfer->top();
                while (a != "(") {
                    transfer->pop();
                    post_fit_array[postfitIdx] = a;
                    postfitIdx++;
                    a = transfer->top();
                }
                transfer->pop();//pop the "(";
            }
        }
        else {//如果为运算符
            if (input_array[i] == "*" || input_array[i] == "/") {
                while (!transfer->empty() && transfer->top() != "("&&(transfer->top() == "*" || transfer->top() == "/")) {
                    post_fit_array[postfitIdx] = transfer->top();
                    transfer->pop();
                    postfitIdx++;
                }
            }
            else if (input_array[i] == "+" || input_array[i] == "-") {
                while (!transfer->empty() && transfer->top() != "(") {
                    post_fit_array[postfitIdx] = transfer->top();
                    transfer->pop();
                    postfitIdx++;
                }
            }
            else {
                cout << "wrong case" << endl;
            }
            transfer->push(input_array[i]);
        }
    }
    while (!transfer->empty()) {
        post_fit_array[postfitIdx] = transfer->top();
        transfer->pop();
        postfitIdx++;
    }
    delete transfer;
}
int inline string_to_int(string s) {
    int len = s.length();
    int ret = 0;
    for (int i = 0; i < len; i++) {
        ret = ret * 10 + s[i] - '0';
    }
    return ret;
}
int calu_num(int num1, int num2, string cal) {//运算得到结果
    if (cal == "*") {
        return num1 * num2;
    }
    else if (cal == "/") {
        return num1 / num2;
    }
    else if (cal == "-") {
        return num1 - num2;
    }
    else if (cal == "+") {
        return num1 + num2;
    }
    cout << "error" << endl;
    return 0;
}
void calculate_result() {
    idx -= kuohao_num;
    Stack<int>* store = new Stack<int>;
    for (int i = 0; i < idx; i++) {
        if (post_fit_array[i][0] >= '0' && post_fit_array[i][0] <= '9') {//operation number
            store->push(string_to_int(post_fit_array[i]));
        }
        else {
            int a1 = store->top();
            store->pop();
            int a2 = store->top();
            store->pop();
            store->push(calu_num(a2, a1, post_fit_array[i]));
        }
    }
    cout << store->top() << endl;
    delete store;
}
void eraser_cache() {
    for (int i = 0; i < 620; i++) {
        input_array[i] = "";
        post_fit_array[i] = "";
    }
    kuohao_num = 0;
    idx = 0;
}

int main() {
    int t;
    cin >> t;
    for (int i = 0; i < t; i++) {
        input_store();
        transform_to_back();
        calculate_result();
        eraser_cache();
    }
    return 0;
}