//我把题目想复杂了，其实只需要在括号中填一个字符
#include<iostream>
#include<string>
using namespace std;
string origin_input[52];
string middle_string[52];
string correct_ans;
string mid_correct;
int n;
/*
void process_string() {
    //cut the head and the tail;I just need to count.
    //I should make sure that every answer from students has the same head and tail with the right ans;
    int len_cor = correct_ans.length();
    int left_bracket=0, right_bracket=0;
    for (int i = 0; i < len_cor; i++) {
        if (correct_ans[i] == '[') {
            left_bracket = i;
        }
        if (correct_ans[i] == ']') {
            right_bracket = i;
        }
    }
    string tmp = "";
    for (int i = left_bracket + 1; i < right_bracket; i++) {
        tmp += correct_ans[i];
    }
    mid_correct = tmp;
    int right_cnt = len_cor - right_bracket-1;
    for (int idx = 0; idx < n; idx++) {
        tmp = "";
        int l = origin_input[idx].length();
        for (int i = left_bracket; i < l-right_cnt; i++) {
            tmp += origin_input[idx][i];
        }
        middle_string[idx] = tmp;
    }
    tmp = "";
    
}*/
void process_string() {
    // 提取模板中括号内的字符集合
    int left_bracket = correct_ans.find('[');
    int right_bracket = correct_ans.find(']');

    string prefix = correct_ans.substr(0, left_bracket); // 模板的前缀
    string suffix = correct_ans.substr(right_bracket + 1); // 模板的后缀
    cout<<"prefix="<<prefix<<"   suffix="<<suffix<<endl;
    mid_correct = correct_ans.substr(left_bracket + 1, right_bracket - left_bracket - 1); // 中括号内的内容

    // 对每个学生提交的作业处理
    for (int idx = 0; idx < n; idx++) {
        string& student = origin_input[idx];
        if (student.substr(0, left_bracket) == prefix &&
            student.substr(student.length() - suffix.length()) == suffix) {
            // 提取学生提交字符串中间的部分
            middle_string[idx] = student.substr(left_bracket, student.length() - left_bracket - suffix.length());
        }
        else {
            middle_string[idx] = ""; // 不匹配则留空
        }
    }
}
bool judge_fit(string s, string t) {// pay attention the capital and lowercase letter shouldn't be distincted.
    //here we use plain algorithm to judge.
    int point_s, point_t;
    int l_s = s.length(); int l_t = t.length();
    if (l_s == 0 || l_s > l_t) {
        return false;
    }
    for (int s_head = 0; s_head <= l_t - l_s; s_head++) {
        point_s = s_head;
        point_t = 0;
        while (point_s < l_s && point_t < l_s) {
            if ((s[point_s] <= '9' && s[point_s] != t[point_t]) ||
                (s[point_s] >= 'A' && s[point_s] <= 'Z' && s[point_s] != t[point_t] && s[point_s] + 32 != t[point_t]) ||
                (s[point_s] >= 'a' && s[point_s] <= 'z' && s[point_s] != t[point_t] && s[point_s] - 32 != t[point_t])) {
                break;//I'm sure they can't match.
            }
            else {
                point_s++;
                point_t++;
            }
        }
        if (point_s == l_s) {
            return true;
        }
    }
    return false;
}
int main() {
    cin >> n;
    for (int i = 0; i < n; i++) {
        cin >> origin_input[i];
    }
    cin >> correct_ans;
    process_string();
    for (int i = 0; i < n; i++) {
        if (judge_fit(middle_string[i], mid_correct)) {
            cout << i + 1 << ' ' << origin_input[i] << endl;
        }
    }
    return 0;
}